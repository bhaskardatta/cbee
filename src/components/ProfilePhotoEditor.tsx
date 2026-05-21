import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { colorClasses } from "@/lib/theme";
import { Upload, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getVerifiedSession } from "@/integrations/supabase/auth-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface ProfilePhotoEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onPhotoUpdate: (url: string) => void;
}

const ProfilePhotoEditor = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onPhotoUpdate,
}: ProfilePhotoEditorProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null
  );
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // --- File Selection ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImageElement(img);
        // Use requestAnimationFrame for Safari compatibility
        requestAnimationFrame(() => {
          setTimeout(() => {
            const imgEl = imageRef.current;
            if (!imgEl) return;
            const rect = imgEl.getBoundingClientRect();

            const natW = img.naturalWidth;
            const natH = img.naturalHeight;
            const r = Math.min(rect.width / natW, rect.height / natH);
            const displayedWidth = natW * r;
            const displayedHeight = natH * r;

            const offsetX = (rect.width - displayedWidth) / 2;
            const offsetY = (rect.height - displayedHeight) / 2;

            const size = Math.min(200, displayedWidth, displayedHeight);
            setCropArea({
              x: offsetX + (displayedWidth - size) / 2,
              y: offsetY + (displayedHeight - size) / 2,
              size,
            });
          }, 100);
        });
      };
      img.src = result;
    };
    reader.onerror = () => {
      toast({
        title: "Failed to load image",
        description: "Please try selecting a different image",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  // --- Drag Start (mouse + touch) ---
  const startDrag = (clientX: number, clientY: number, rect: DOMRect) => {
    setIsDragging(true);
    setDragStart({
      x: clientX - rect.left - cropArea.x,
      y: clientY - rect.top - cropArea.y,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, rect);
  };

  // --- Drag Move ---
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !imageRef.current) return;

      const img = imageRef.current;
      const rect = img.getBoundingClientRect();

      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const r = Math.min(rect.width / natW, rect.height / natH);
      const displayedWidth = natW * r;
      const displayedHeight = natH * r;

      const offsetX = (rect.width - displayedWidth) / 2;
      const offsetY = (rect.height - displayedHeight) / 2;

      const minX = offsetX;
      const maxX = offsetX + displayedWidth - cropArea.size;
      const minY = offsetY;
      const maxY = offsetY + displayedHeight - cropArea.size;

      const newX = Math.max(
        minX,
        Math.min(clientX - rect.left - dragStart.x, maxX)
      );
      const newY = Math.max(
        minY,
        Math.min(clientY - rect.top - dragStart.y, maxY)
      );

      setCropArea((prev) => ({ ...prev, x: newX, y: newY }));
    },
    [isDragging, dragStart, cropArea.size]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Global Event Listeners (Safari-compatible) ---
  useEffect(() => {
    const moveHandler = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      if ("touches" in e && e.touches.length > 0) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      } else if ("clientX" in e) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const upHandler = () => handleMouseUp();

    if (isDragging) {
      // Use passive: false for touch events to allow preventDefault
      document.addEventListener("mousemove", moveHandler, { passive: false });
      document.addEventListener("mouseup", upHandler);
      document.addEventListener("touchmove", moveHandler, { passive: false });
      document.addEventListener("touchend", upHandler);
      document.addEventListener("touchcancel", upHandler);
    }
    return () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
      document.removeEventListener("touchmove", moveHandler);
      document.removeEventListener("touchend", upHandler);
      document.removeEventListener("touchcancel", upHandler);
    };
  }, [isDragging, handleMove, handleMouseUp]);

  // --- Crop Function (Safari-compatible) ---
  const cropImage = (
    imageSrc: string,
    crop: { x: number; y: number; size: number }
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imageRef.current) {
          reject(new Error("Canvas or image reference not available"));
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        canvas.width = 200;
        canvas.height = 200;

        const imgEl = imageRef.current;
        const rect = imgEl.getBoundingClientRect();

        const natW = image.naturalWidth;
        const natH = image.naturalHeight;
        const r = Math.min(rect.width / natW, rect.height / natH);
        const displayedWidth = natW * r;
        const displayedHeight = natH * r;
        const offsetX = (rect.width - displayedWidth) / 2;
        const offsetY = (rect.height - displayedHeight) / 2;

        const scale = natW / displayedWidth;

        let sourceX = (crop.x - offsetX) * scale;
        let sourceY = (crop.y - offsetY) * scale;
        let sourceSize = crop.size * scale;

        sourceX = Math.max(0, Math.min(sourceX, natW - sourceSize));
        sourceY = Math.max(0, Math.min(sourceY, natH - sourceSize));

        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          200,
          200
        );

        // Safari-compatible toBlob with fallback
        const fallbackToDataUrl = () => {
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const byteString = atob(dataUrl.split(",")[1]);
            const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mimeString }));
          } catch (fallbackError) {
            reject(new Error("Failed to create image blob"));
          }
        };

        try {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                fallbackToDataUrl();
              }
            },
            "image/jpeg",
            0.8
          );
        } catch (e) {
          fallbackToDataUrl();
        }
      };
      image.onerror = () => {
        reject(new Error("Failed to load image for cropping"));
      };
      image.src = imageSrc;
    });
  };

  // --- Save Handler ---
  const handleSave = async () => {
    if (!selectedImage || !user) return;
    
    // CRITICAL: Verify authentication before any database operation (Safari fix)
    const session = await getVerifiedSession();
    if (!session?.user?.id) {
      console.error('[Safari Avatar Update] No authenticated session - blocking update');
      toast({
        title: "Session expired",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    console.log('[Safari Avatar Update] Starting for user:', session.user.id);
    
    setIsUploading(true);
    try {
      const croppedBlob = await cropImage(selectedImage, cropArea);

      const fileName = `${session.user.id}-${Date.now()}.jpg`;
      console.log('[Safari Avatar Update] Uploading to storage:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(`avatars/${session.user.id}/${fileName}`, croppedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error('[Safari Avatar Update] Storage upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(`avatars/${session.user.id}/${fileName}`);

      const avatarUrl = urlData.publicUrl;
      console.log('[Safari Avatar Update] Got public URL:', avatarUrl);

      // Update profile with .select().maybeSingle() for Safari compatibility
      // Verify the update actually succeeded by checking returned data
      console.log('[Safari Avatar Update] Updating database...');
      
      const { data: updateData, error: updateError, count } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", session.user.id)
        .select('*')
        .maybeSingle();

      console.log('[Safari Avatar Update] Database response:', { 
        data: updateData, 
        error: updateError, 
        count,
        hasData: !!updateData 
      });

      if (updateError) {
        console.error('[Safari Avatar Update] Database error:', updateError);
        throw updateError;
      }
      
      // CRITICAL: If no data returned, the update failed
      if (!updateData) {
        console.error('[Safari Avatar Update] Update returned null - RLS may have blocked the write');
        throw new Error('Avatar update failed - your session may have expired. Please refresh the page and try again.');
      }
      
      console.log('[Safari Avatar Update] SUCCESS - Updated profile:', updateData);

      // Only invalidate and refetch after confirmed successful database update
      // Do NOT use setQueryData - let the refetch get fresh data from the database
      queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
      queryClient.refetchQueries({ queryKey: ['profile', session.user.id] });

      const timestampedUrl = `${avatarUrl}?t=${Date.now()}`;
      onPhotoUpdate(timestampedUrl);

      toast({
        title: "Profile photo updated!",
        description: "Your new profile photo has been saved.",
      });
      onClose();
      setSelectedImage(null);
      setImageElement(null);
    } catch (error) {
      console.error("[Safari Avatar Update] Error:", error);
      toast({
        title: "Failed to update photo",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedImage ? (
            <div className="flex flex-col space-y-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className={`${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
              >
                <Upload className="w-4 h-4" />
                Choose Photo
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden select-text"
                style={{ userSelect: "auto" }}
              />

              {currentAvatarUrl && (
                <div className="text-center">
                  <img
                    src={currentAvatarUrl}
                    alt="Current profile"
                    className="w-20 h-20 rounded-full mx-auto object-cover"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Current photo
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative inline-block mx-auto">
                <div className="relative overflow-hidden rounded-lg">
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Selected"
                    className="max-w-full max-h-80 object-contain"
                    draggable={false}
                  />
                  <div
                    className="absolute rounded-full cursor-move"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: cropArea.size,
                      height: cropArea.size,
                      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                      border: "2px solid rgba(255,255,255,0.9)",
                      userSelect: "none",
                      pointerEvents: "auto",
                      touchAction: "none",
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Drag the circle to choose your profile picture
                </p>
                <div className="flex justify-center space-x-2">
                  <Button
                    size="sm"
                    className={`h-9 px-4 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>

                  <Button
                    size="sm"
                    className={`h-9 px-4 flex-1 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                    onClick={handleSave}
                    disabled={isUploading}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {isUploading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePhotoEditor;
