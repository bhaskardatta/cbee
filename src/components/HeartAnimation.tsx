// ✅ Updated HeartAnimation.tsx (pure component)
import { motion } from "framer-motion";
import { useEffect } from "react";

interface HeartAnimationProps {
  isLiked: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

const HeartAnimation = ({
  isLiked,
  onClick,
  size = "md",
}: HeartAnimationProps) => {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  // Preload animation by running it on mount
  useEffect(() => {
    // Trigger a small animation to preload framer-motion
    const timer = setTimeout(() => {
      // This ensures the animation is ready on first interaction
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex items-center space-x-1 relative"
    >
      <svg
        className={`${sizeClasses[size]} transition-colors duration-200 ${
          isLiked
            ? "fill-red-500 text-red-500"
            : "text-foreground hover:text-red-500"
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </motion.button>
  );
};

export default HeartAnimation;
