import { useEffect, useRef } from "react";

export const useMobileKeyboard = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle mobile keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "Enter":
            // Send message on Ctrl+Enter
            e.preventDefault();
            const sendButton = document.querySelector(
              "[data-send-button]"
            ) as HTMLButtonElement;
            if (sendButton && !sendButton.disabled) {
              sendButton.click();
            }
            break;
          case "e":
            // Toggle emoji picker on Ctrl+E
            e.preventDefault();
            const emojiButton = document.querySelector(
              "[data-emoji-button]"
            ) as HTMLButtonElement;
            if (emojiButton) {
              emojiButton.click();
            }
            break;
        }
      }
    };

    const handleInput = (e: InputEvent) => {
      // Handle mobile keyboard input events
      const target = e.target as HTMLInputElement;
      if (target && target.contentEditable === "true") {
        // Handle rich text input from mobile keyboards
        const text = target.textContent || "";
        if (text.includes("😀") || text.includes("😃") || text.includes("😄")) {
          // Handle emoji input from mobile keyboards
          const emojiMatch = text.match(
            /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu
          );
          if (emojiMatch) {
            // Process emoji input
            console.log("Emoji detected:", emojiMatch);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("input", handleInput as EventListener);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("input", handleInput as EventListener);
    };
  }, []);

  return { inputRef };
};
