// Color theme constants for the entire application
export const theme = {
  colors: {
    primary: "#26A69A",
    primaryHover: "#26A69A/90",
    primaryLight: "#26A69A/100",
    primaryHoverLight: "#26A69A/10",
    white: "#FFFFFF",
    black: "#000000",
    gray: {
      50: "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      300: "#D1D5DB",
      400: "#9CA3AF",
      500: "#6B7280",
      600: "#4B5563",
      700: "#374151",
      800: "#1F2937",
      900: "#111827",
    },
    red: {
      500: "#EF4444",
    },
    destructive: "#EF4444",
    muted: "#6B7280",
    mutedForeground: "#9CA3AF",
    border: "#E5E7EB",
    background: "#FFFFFF",
    card: "#FFFFFF",
    foreground: "#111827",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
} as const;

// Helper function to get color with opacity
export const withOpacity = (color: string, opacity: number) => {
  return `${color}/${opacity * 100}`;
};

// Common color classes for Tailwind
export const colorClasses = {
  primary: "text-[#26A69A]",
  primaryBg: "bg-[#26A69A]",
  primaryBgHover: "hover:bg-[#26A69A]/90",
  primaryBgLight: "bg-[#26A69A]/20",
  primaryBgHoverLight: "hover:bg-[#26A69A]/10",
  white: "text-white",
  whiteBg: "bg-white",
  black: "text-black",
  gray: {
    50: "text-gray-50",
    100: "text-gray-100",
    200: "text-gray-200",
    300: "text-gray-300",
    400: "text-gray-400",
    500: "text-gray-500",
    600: "text-gray-600",
    700: "text-gray-700",
    800: "text-gray-800",
    900: "text-gray-900",
  },
  red: {
    500: "text-red-500",
    fill: "fill-red-500",
  },
} as const;
