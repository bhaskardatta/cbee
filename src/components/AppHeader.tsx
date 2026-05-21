import { ReactNode, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/theme";
import FeedbackSupport from "./FeedbackSupport";
import { usePlatform } from "@/hooks/usePlatform";

// Reusable loader
const Loader = ({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) => {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-4 border-t-transparent",
        className
      )}
      style={{
        width: size,
        height: size,
        borderColor: "#26A69A",
        borderTopColor: "transparent",
      }}
    />
  );
};

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  rightAction?: ReactNode;
  className?: string;
  transparent?: boolean;
  showMessagesAndFeedback?: boolean;
}

const AppHeader = ({
  title,
  showBackButton = false,
  rightAction,
  className,
  transparent = false,
  showMessagesAndFeedback = false,
}: AppHeaderProps) => {
  const navigate = useNavigate();
  const { isNative } = usePlatform();

  const [hideHeader, setHideHeader] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const pullDistanceY = useRef(0);
  const triggered = useRef(false);
  const pullIndicatorRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  // Scroll hiding logic with smooth transitions
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > 50 && currentScrollY > lastScrollY) {
            setHideHeader(true);
          } else if (currentScrollY < lastScrollY) {
            setHideHeader(false);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Smooth pull-to-refresh with visual feedback
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        pullDistanceY.current = 0;
        triggered.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && touchStartY.current > 0) {
        const currentY = e.touches[0].clientY;
        const rawPull = currentY - touchStartY.current;
        
        if (rawPull > 0) {
          // Apply resistance curve for smoother feel
          pullDistanceY.current = Math.min(
            MAX_PULL,
            rawPull * (1 - rawPull / (MAX_PULL * 3))
          );

          // Visual feedback with scale
          if (pullIndicatorRef.current) {
            const progress = Math.min(1, pullDistanceY.current / PULL_THRESHOLD);
            pullIndicatorRef.current.style.transform = `translateY(${pullDistanceY.current / 2}px) scale(${0.5 + progress * 0.5})`;
            pullIndicatorRef.current.style.opacity = `${progress}`;
          }

          if (pullDistanceY.current >= PULL_THRESHOLD && !triggered.current) {
            triggered.current = true;
            if (navigator.vibrate) {
              navigator.vibrate(10); // Haptic feedback
            }
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistanceY.current >= PULL_THRESHOLD && triggered.current) {
        setIsRefreshing(true);
        
        // Smooth transition
        if (pullIndicatorRef.current) {
          pullIndicatorRef.current.style.transform = 'translateY(30px) scale(1)';
        }

        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        // Reset smoothly
        if (pullIndicatorRef.current) {
          pullIndicatorRef.current.style.transform = 'translateY(0) scale(0.5)';
          pullIndicatorRef.current.style.opacity = '0';
        }
      }

      touchStartY.current = 0;
      pullDistanceY.current = 0;
      triggered.current = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <div
        ref={pullIndicatorRef}
        className="fixed top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 ease-out"
        style={{
          transform: 'translateY(0) scale(0.5)',
          opacity: 0,
        }}
      >
        <Loader size={24} />
      </div>

      <header
        data-header="true"
        className={cn(
          "fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 transition-transform duration-300 select-none",
          hideHeader ? "-translate-y-full" : "translate-y-0",
          !transparent && "bg-background/80 backdrop-blur-md",
          className
        )}
        style={{
          paddingTop: "var(--safe-top, 0px)",
          paddingBottom: "12px",
          minHeight: "56px",
        }}
      >
        <div className="flex items-center select-none">
          {showBackButton && (
            <button
              onClick={handleBack}
              className={`mr-4 p-2 rounded-full select-none ${colorClasses.primaryBgHoverLight}`}
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5 text-[#26A69A]/100" />
            </button>
          )}
          {!title && !showBackButton && (
            <Link to="/" className="flex items-center select-none">
              <h1 className="font-greatvibes text-5xl text-[#26A69A]/100 select-none mt-2">
                cbee
              </h1>
            </Link>
          )}
          {title && (
            <h1 className="font-semibold text-xl select-none">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2 select-none">
          {rightAction && rightAction}
          {showMessagesAndFeedback && (
            <>
              <Link
                to="/messages"
                className="scale-125 focus:outline-none focus:ring-0 select-none"
              >
                <AudioLines className="w-5 h-5 text-[#26A69A]/100" />
              </Link>
              <div className="scale-125 focus:outline-none focus:ring-0 select-none">
                <FeedbackSupport />
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};

export default AppHeader;
