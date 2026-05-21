import { useEffect, useState } from "react";

interface AnimatedEmojiProps {
  emoji: string;
  isVisible: boolean;
  onAnimationComplete?: () => void;
}

export default function AnimatedEmoji({
  emoji,
  isVisible,
  onAnimationComplete,
}: AnimatedEmojiProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
      }, 800); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationComplete]);

  return (
    <span
      className={`inline-block text-2xl ${
        isAnimating ? "animate-emoji-send" : ""
      }`}
      style={{
        animationDelay: "0ms",
        animationFillMode: "both",
      }}
    >
      {emoji}
    </span>
  );
}
