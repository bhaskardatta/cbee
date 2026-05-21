import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

const emojiCategories = [
  {
    name: "Smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "😎",
      "🤓",
      "🧐",
    ],
  },
  {
    name: "Animals",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐒",
      "🦍",
      "🦧",
      "🐕",
      "🐩",
      "🦮",
      "🐕‍🦺",
      "🐈",
      "🐓",
      "🦃",
      "🦚",
      "🦜",
      "🦢",
      "🦩",
      "🕊",
      "🐇",
      "🦝",
      "🦨",
      "🦡",
      "🦦",
      "🦥",
      "🐁",
      "🐀",
      "🐿",
      "🦔",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍎",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥖",
      "🍞",
      "🥨",
      "🥯",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🦴",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
    ],
  },
  {
    name: "Activities",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🎽",
      "🛹",
      "🛷",
      "⛸",
      "🥌",
      "🎿",
      "⛷",
      "🏂",
      "🪂",
      "🏋️‍♀️",
      "🏋️",
      "🏋️‍♂️",
      "🤼‍♀️",
      "🤼",
      "🤼‍♂️",
      "🤸‍♀️",
      "🤸",
      "🤸‍♂️",
      "⛹️‍♀️",
      "⛹️",
      "⛹️‍♂️",
      "🤺",
      "🤾‍♀️",
      "🤾",
      "🤾‍♂️",
      "🏌️‍♀️",
      "🏌️",
      "🏌️‍♂️",
    ],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmojiPicker({
  onEmojiSelect,
  isOpen,
  onClose,
}: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  // Handle emoji selection with animation
  const handleEmojiClick = (emoji: string) => {
    setSelectedEmoji(emoji);
    onEmojiSelect(emoji);
    onClose();

    // Reset selection after animation
    setTimeout(() => setSelectedEmoji(null), 300);
  };

  // Add entrance animation
  useEffect(() => {
    if (isOpen) {
      const picker = document.querySelector("[data-emoji-picker-container]");
      if (picker) {
        picker.classList.add("emoji-picker-enter");
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      data-emoji-picker-container
      className="emoji-picker-container absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg max-h-64 overflow-hidden"
    >
      <div className="p-2 border-b">
        <div className="flex space-x-1 overflow-x-auto">
          {emojiCategories.map((category, index) => (
            <Button
              key={category.name}
              variant={selectedCategory === index ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(index)}
              className={`category-button text-xs whitespace-nowrap ${
                selectedCategory === index ? "active" : ""
              }`}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>
      <div className="p-2 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {emojiCategories[selectedCategory].emojis.map((emoji, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => handleEmojiClick(emoji)}
              className={`emoji-button emoji-button-hover text-lg p-1 h-8 w-8 hover:bg-muted emoji-grid-item ${
                selectedEmoji === emoji ? "emoji-button-selected" : ""
              }`}
              style={{
                animationDelay: `${index * 20}ms`,
                animationFillMode: "both",
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
