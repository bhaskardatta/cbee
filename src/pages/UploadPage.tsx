import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { CameraPreview } from "@capgo/camera-preview";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Image, Video, Camera, MapPin, MessageCircle, Hash } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatePost } from "@/hooks/usePosts";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { toast } from "@/components/ui/sonner";
import NativeCameraSheet from "@/components/camera/NativeCameraSheet";
import {
  consumePendingCapture,
  clearPendingCapture,
  type CameraCaptureResult,
} from "@/hooks/useNativeCamera";
import {
  getVideoMetadata,
  getImageMetadata,
  makeVideoThumbnail,
  MAX_REEL_DURATION_SECONDS,
  type AspectRatio,
} from "@/lib/media";

/**
 * Metadata for the currently-selected file. Filled in by either the native
 * camera flow (CameraCaptureResult contains it) or the gallery import flow
 * (we probe it via getVideoMetadata / getImageMetadata).
 */
interface CaptureMeta {
  mediaKind: "image" | "video";
  aspectRatio: AspectRatio;
  durationSeconds?: number;
}

const UploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: createPost, isPending: isCreating } = useCreatePost();
  const { upload, isUploading, progress } = useMediaUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [meta, setMeta] = useState<CaptureMeta | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  const isBusy = isUploading || isCreating;

  // Rehydrate from a pending camera capture if the WebView was reloaded
  // between capture-success and the React state update (Samsung S22 + heavy
  // memory pressure reproduces this). consumePendingCapture clears the
  // stored entry, so it only fires once per app lifetime.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending = await consumePendingCapture();
        if (cancelled || !pending) return;
        setSelectedFile(pending.file);
        setPreview(URL.createObjectURL(pending.file));
        setMeta({
          mediaKind: pending.kind === "photo" ? "image" : "video",
          aspectRatio: pending.aspectRatio,
          durationSeconds:
            pending.kind === "video" ? pending.durationSeconds : undefined,
        });
        toast("Restored your last capture — tap Share to post.");
      } catch (e) {
        console.warn("[UploadPage] consumePendingCapture failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Gallery import (existing flow + 60s video cap + meta probe)        */
  /* ------------------------------------------------------------------ */

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Type guard
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast("Please select an image or video file");
      return;
    }

    // Size cap — matches the edge function's per-kind cap
    const isVideo = file.type.startsWith("video/");
    const maxBytes = isVideo ? 60 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast(`File too large. Max ${maxBytes / (1024 * 1024)}MB for ${isVideo ? "videos" : "images"}.`);
      return;
    }

    try {
      if (isVideo) {
        const videoMeta = await getVideoMetadata(file);
        // Only enforce the duration cap if we successfully probed it. A
        // probe-failure returns durationSeconds=0; we let the edge function
        // (which checks contentLength) be the final gate rather than block
        // the user on a metadata read that flaked.
        if (
          videoMeta.durationSeconds > 0 &&
          videoMeta.durationSeconds > MAX_REEL_DURATION_SECONDS
        ) {
          toast(
            `Videos must be ${MAX_REEL_DURATION_SECONDS}s or less. This one is ${Math.round(videoMeta.durationSeconds)}s.`,
          );
          return;
        }
        setSelectedFile(file);
        setMeta({
          mediaKind: "video",
          aspectRatio: videoMeta.aspectRatio,
          durationSeconds:
            videoMeta.durationSeconds > 0 ? videoMeta.durationSeconds : undefined,
        });
        setPreview(URL.createObjectURL(file));
      } else {
        const imgMeta = await getImageMetadata(file);
        setSelectedFile(file);
        setMeta({
          mediaKind: "image",
          aspectRatio: imgMeta.aspectRatio,
        });
        setPreview(URL.createObjectURL(file));
      }
    } catch (e) {
      console.error("[UploadPage] file probe failed:", e);
      toast(
        e instanceof Error
          ? `Could not read that file: ${e.message}`
          : "Could not read that file. Try another.",
      );
    } finally {
      // Important: clear the input so re-picking the SAME file fires onChange
      // again. Some Android WebViews suppress duplicate onChange events.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Native camera capture                                              */
  /* ------------------------------------------------------------------ */

  const handleCameraCapture = (result: CameraCaptureResult) => {
    setCameraOpen(false);
    setSelectedFile(result.file);
    setPreview(URL.createObjectURL(result.file));
    setMeta({
      mediaKind: result.kind === "photo" ? "image" : "video",
      aspectRatio: result.aspectRatio,
      durationSeconds: result.kind === "video" ? result.durationSeconds : undefined,
    });
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  /**
   * Pre-request camera + mic permissions BEFORE mounting the camera sheet.
   *
   * Why: on Samsung Android, the first-time runtime permission dialog
   * causes the activity to enter onPause → onResume, which makes the
   * Capacitor WebView's React tree re-mount. If we request permissions
   * inside the camera sheet's useEffect, the re-mount fires the cleanup
   * (`stopPreview`) while the new mount is calling `startPreview`,
   * leaving the native camera in an inconsistent state ("camera running"
   * but no surface drawing). Resolving permission BEFORE the sheet opens
   * means the second open never sees an OS dialog, so the activity stays
   * resumed and the lifecycle is clean.
   */
  const openCameraSheet = async () => {
    if (!Capacitor.isNativePlatform()) {
      setCameraOpen(true);
      return;
    }
    try {
      const status = await CameraPreview.checkPermissions();
      const needsAsk =
        status?.camera !== "granted" || status?.microphone !== "granted";
      if (needsAsk) {
        const res = await CameraPreview.requestPermissions({
          disableAudio: false,
          showSettingsAlert: true,
        });
        if (res?.camera !== "granted") {
          toast(
            "Camera permission is needed to take photos and videos. Enable it in Settings.",
          );
          return;
        }
      }
    } catch (e) {
      console.warn(
        "[UploadPage] pre-permission check failed; opening sheet anyway",
        e,
      );
    }
    setCameraOpen(true);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setMeta(null);
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ------------------------------------------------------------------ */
  /*  Submit — R2 upload → optional thumbnail → posts insert              */
  /* ------------------------------------------------------------------ */

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !user || !meta) {
      toast("Please select a file and make sure you're logged in");
      return;
    }

    // 1. Upload main media to R2
    const result = await upload(selectedFile, meta.mediaKind);
    if (!result) {
      // useMediaUpload already toasted the error
      return;
    }
    const mediaPublicUrl = result.publicUrl;

    // 2. For videos, generate + upload a thumbnail (don't block on failure)
    let thumbnailUrl: string | null = null;
    if (meta.mediaKind === "video") {
      try {
        const thumb = await makeVideoThumbnail(selectedFile);
        const thumbResult = await upload(thumb, "thumbnail");
        thumbnailUrl = thumbResult?.publicUrl ?? null;
      } catch (e) {
        console.warn("[UploadPage] thumbnail generation failed (non-fatal):", e);
      }
    }

    // 3. Build hashtags array
    const hashtagArray = hashtags
      .split(/\s+/)
      .filter((tag) => tag.startsWith("#"))
      .map((tag) => tag.slice(1).toLowerCase());

    // 4. Insert post row. The sync trigger keeps `type` and `media_kind`
    //    aligned, so Phase 1 readers of `type` keep working.
    createPost(
      {
        user_id: user.id,
        type: meta.mediaKind === "video" ? "video" : "photo",
        media_url: mediaPublicUrl,
        caption: caption || null,
        location: location || null,
        hashtags: hashtagArray.length > 0 ? hashtagArray : null,
        media_kind: meta.mediaKind,
        media_aspect_ratio: meta.aspectRatio,
        duration_seconds: meta.durationSeconds ?? null,
        thumbnail_url: thumbnailUrl,
      },
      {
      onSuccess: () => {
        toast("Post created successfully!");
        if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
        // Drop the stored capture path — the file now lives in posts.media_url.
        void clearPendingCapture();
        navigate("/");
      },
      onError: (error) => {
        toast("Failed to create post. Please try again.");
        console.error("Post creation error:", error);
      },
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen">
      <AppHeader title="Create Post" showBackButton />

      <Layout>
        <div className="px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload area */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {preview ? (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg overflow-hidden">
                    {meta?.mediaKind === "video" ? (
                      <video
                        src={preview}
                        controls
                        playsInline
                        className="w-full h-auto object-contain max-h-96"
                      />
                    ) : (
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-auto object-contain max-h-96"
                      />
                    )}
                  </div>
                  {meta && (
                    <p className="text-xs text-muted-foreground">
                      {meta.mediaKind === "video"
                        ? `${meta.aspectRatio} · ${Math.round(meta.durationSeconds ?? 0)}s video`
                        : `${meta.aspectRatio} image`}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button type="button" variant="outline" onClick={triggerFileSelect} disabled={isBusy}>
                      Gallery
                    </Button>
                    <Button type="button" variant="outline" onClick={openCameraSheet} disabled={isBusy}>
                      <Camera className="w-4 h-4 mr-1" /> Re-shoot
                    </Button>
                    <Button type="button" variant="outline" onClick={clearSelection} disabled={isBusy}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center space-x-4">
                    <Image className="w-12 h-12 text-muted-foreground" />
                    <Video className="w-12 h-12 text-muted-foreground" />
                    <Camera className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload a photo or video</h3>
                    <p className="text-muted-foreground mb-4">
                      Share your pet's moments with the community
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Images up to 10MB · Videos up to 60s, 60MB
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button
                      type="button"
                      className="bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
                      onClick={openCameraSheet}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo or Video
                    </Button>
                    <Button type="button" variant="outline" onClick={triggerFileSelect}>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose from Gallery
                    </Button>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                multiple={false}
              />
            </div>

            {/* Caption */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                Caption
              </label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your post..."
                className="resize-none"
                rows={3}
                disabled={isBusy}
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add a location..."
                disabled={isBusy}
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                <Hash className="w-4 h-4" />
                Hashtags
              </label>
              <Input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#cute #pets #dogs"
                disabled={isBusy}
              />
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#26A69A] transition-[width]"
                    style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Uploading… {Math.round(progress * 100)}%
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
              disabled={!selectedFile || isBusy}
            >
              {isUploading ? "Uploading…" : isCreating ? "Posting…" : "Share Post"}
            </Button>
          </form>
        </div>
      </Layout>

      {/* Full-screen camera sheet */}
      <NativeCameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default UploadPage;
