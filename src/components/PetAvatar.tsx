import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PetAvatarProps {
  src?: string;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const PetAvatar = ({ src, name, className, size = "md" }: PetAvatarProps) => {
  const firstLetter = name?.[0]?.toLowerCase() || "?";

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-20 w-20",
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-5xl",
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="bg-[#26A69A]/20 text-[#26A69A] font-medium">
        <div className="flex items-center justify-center h-full w-full">
          <span className={cn("font-greatvibes", textSizes[size])}>
            {firstLetter}
          </span>
        </div>
      </AvatarFallback>
    </Avatar>
  );
};

export default PetAvatar;
