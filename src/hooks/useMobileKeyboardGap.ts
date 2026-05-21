import { useEffect, useState } from "react";

export const useMobileKeyboardGap = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const initialHeight = window.innerHeight;
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialHeight - currentHeight;

      // If height difference is significant (keyboard is open)
      if (heightDifference > 150) {
        setKeyboardHeight(heightDifference);
        setIsKeyboardOpen(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
      }
    };

    // Handle orientation change
    const handleOrientationChange = () => {
      setTimeout(handleResize, 100); // Small delay to ensure proper measurement
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const heightDifference =
          window.innerHeight - window.visualViewport.height;
        if (heightDifference > 150) {
          setKeyboardHeight(heightDifference);
          setIsKeyboardOpen(true);
        } else {
          setKeyboardHeight(0);
          setIsKeyboardOpen(false);
        }
      }
    };

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        handleVisualViewportChange
      );
    }

    // Fallback for older browsers
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    // Initial check
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          handleVisualViewportChange
        );
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen,
    // Calculate the reduced gap (maximum 8px gap, not increasing)
    reducedGap: Math.min(8, keyboardHeight * 0.05),
  };
};
