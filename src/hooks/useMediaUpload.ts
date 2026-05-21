import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MAX_UPLOAD_BYTES } from "@/lib/media";

/* -------------------------------------------------------------------------- */
/*  Legacy chat-attachment path (Phase 1)                                     */
/* -------------------------------------------------------------------------- */
/*  Chat media stays on the Supabase Storage `messages` bucket per ADR-017.   */
/*  Only `posts` / avatar / thumbnail content moves to Cloudflare R2.         */
/* -------------------------------------------------------------------------- */

export type MediaType = "image" | "video" | "gif" | "sticker";

/* -------------------------------------------------------------------------- */
/*  R2 signed-URL path (Phase 2)                                              */
/* -------------------------------------------------------------------------- */

export type MediaUploadKind = "image" | "video" | "thumbnail";

export interface MediaUploadResult {
  publicUrl: string;   // https://media.cbee.online/<user_id>/<timestamp>_<kind>.<ext>
  objectKey: string;   // <user_id>/<timestamp>_<kind>.<ext>
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresIn: number;
}

/**
 * PUT a file to an R2 signed URL with progress events.
 *
 * Why XMLHttpRequest, not fetch: fetch does not expose upload progress events,
 * and for a 25MB video on a slow connection the progress bar is a UX must.
 * XMLHttpRequest is otherwise equally well-supported in Capacitor 8 WebViews
 * (Chrome 100+ on Android, WKWebView 16+ on iOS).
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 PUT failed: ${xhr.status} ${xhr.statusText}`));
    xhr.onerror = () => reject(new Error("Network error during R2 PUT"));
    xhr.send(file);
  });
}

/* -------------------------------------------------------------------------- */

export const useMediaUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Phase-1 fallback: upload to the Supabase Storage `posts` bucket directly.
   * Used when the R2 edge function isn't configured yet (returns 500).
   * Once R2 secrets are wired, this path stops getting hit automatically —
   * no caller change needed.
   */
  const uploadToSupabaseStorage = useCallback(
    async (file: File, kind: MediaUploadKind): Promise<MediaUploadResult | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not signed in", variant: "destructive" });
        return null;
      }
      const fileExt = file.name.split(".").pop() ?? (file.type.split("/")[1] || "bin");
      // Path matches the storage RLS policy: <user_id>/<timestamp>_<kind>.<ext>
      const fileName = `${user.id}/${Date.now()}_${kind}.${fileExt}`;

      setProgress(0.1);
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (uploadError) {
        throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
      }
      setProgress(1);
      const { data: { publicUrl } } = supabase.storage
        .from("posts")
        .getPublicUrl(fileName);
      return { publicUrl, objectKey: fileName };
    },
    [],
  );

  /**
   * R2 signed-URL upload (Phase 2). Use for post images/videos, avatars,
   * and video thumbnails.
   *
   * Transparently falls back to Supabase Storage `posts` bucket if the edge
   * function returns 500 "R2 secrets not configured" — keeps the app usable
   * during the Phase-2 rollout window before Cloudflare R2 is wired.
   */
  const upload = useCallback(
    async (file: File, kind: MediaUploadKind): Promise<MediaUploadResult | null> => {
      setIsUploading(true);
      setProgress(0);
      try {
        // Client-side cap mirrors the edge function so we don't round-trip
        // a file we know will be rejected.
        const cap = MAX_UPLOAD_BYTES[kind];
        if (file.size > cap) {
          toast({
            title: "File too large",
            description: `Max ${(cap / (1024 * 1024)).toFixed(0)}MB for ${kind}.`,
            variant: "destructive",
          });
          return null;
        }

        // 1. Ask edge function for a signed URL.
        const { data, error } = await supabase.functions.invoke<SignedUrlResponse>(
          "get-upload-url",
          {
            body: {
              contentType: file.type,
              contentLength: file.size,
              kind,
            },
          },
        );

        // R2 not configured? Fall back to Supabase Storage. We detect this by
        // either a transport error or the edge fn's "R2 secrets not configured"
        // 500 payload. Any 4xx (validation) errors still surface as failures.
        const errMsg = (error?.message ?? "").toLowerCase();
        const r2NotConfigured =
          !data &&
          (errMsg.includes("r2 secrets not configured") ||
            errMsg.includes("server misconfigured") ||
            errMsg.includes("non-2xx") ||
            errMsg.includes("500") ||
            errMsg.includes("failed to send"));

        if (r2NotConfigured) {
          console.warn("[useMediaUpload] R2 not configured — using Supabase Storage fallback");
          return await uploadToSupabaseStorage(file, kind);
        }

        if (error || !data) {
          throw new Error(error?.message ?? "Could not request upload URL");
        }

        // 2. PUT the file directly to R2.
        await putWithProgress(data.uploadUrl, file, setProgress);

        return { publicUrl: data.publicUrl, objectKey: data.objectKey };
      } catch (err) {
        console.error("Upload failed:", err);
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [uploadToSupabaseStorage],
  );

  /**
   * Legacy chat upload to Supabase Storage `messages` bucket (Phase 1).
   * Used by MessagesPage for DM attachments. Do NOT route new code through
   * this — use `upload()` instead.
   */
  const uploadMedia = useCallback(
    async (
      file: File,
      userId: string,
      mediaType: MediaType,
    ): Promise<string | null> => {
      try {
        setIsUploading(true);

        // 10MB images/gifs, 50MB videos — kept lenient for chat where users
        // share longer raw clips than they would in a feed post.
        const maxSize = mediaType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast({
            title: "File too large",
            description: `Maximum size is ${maxSize / (1024 * 1024)}MB`,
            variant: "destructive",
          });
          return null;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const bucketName = "messages";

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucketName).getPublicUrl(fileName);

        return publicUrl;
      } catch (error) {
        console.error("Error uploading media:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload media. Please try again.",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  return {
    /** R2 path — use for posts / avatars / thumbnails. */
    upload,
    /** Legacy Supabase Storage path — chat DM attachments only. */
    uploadMedia,
    isUploading,
    progress,
  };
};
