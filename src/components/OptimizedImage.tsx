import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  eager?: boolean; // For above-the-fold images
  width?: number; // Target render width (used for Supabase image transform + srcset)
}

// Rewrite a Supabase Storage public URL to the on-the-fly render endpoint
// so the CDN serves a resized + compressed variant. Falls back to original
// URL for non-Supabase sources.
const buildSupabaseSrc = (src: string, width: number, quality = 70) => {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (url.pathname.includes("/storage/v1/object/public/")) {
      url.pathname = url.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      url.searchParams.set("width", String(width));
      url.searchParams.set("quality", String(quality));
      url.searchParams.set("resize", "contain");
      return url.toString();
    }
  } catch {
    /* ignore */
  }
  return src;
};

const OptimizedImage = ({
  src,
  alt,
  className,
  containerClassName,
  eager = false,
  width = 800,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "400px", // Pre-fetch well before entering viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [eager]);

  const small = buildSupabaseSrc(src, Math.round(width / 2), 60);
  const medium = buildSupabaseSrc(src, width, 70);
  const large = buildSupabaseSrc(src, Math.min(width * 2, 1600), 75);

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", containerClassName)}>
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {isInView && (
        <img
          src={medium}
          srcSet={`${small} ${Math.round(width / 2)}w, ${medium} ${width}w, ${large} ${Math.min(width * 2, 1600)}w`}
          sizes="(max-width: 640px) 100vw, 600px"
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          // @ts-expect-error fetchpriority is valid HTML, not yet typed
          fetchpriority={eager ? "high" : "low"}
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            // If transform endpoint fails (e.g. non-image), fall back to original
            const img = e.currentTarget;
            if (img.src !== src) {
              img.srcset = "";
              img.src = src;
            }
          }}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
