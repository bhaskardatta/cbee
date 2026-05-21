import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import PetAvatar from "./PetAvatar";

interface ActivityItemProps {
  id: string;
  type: "like" | "comment" | "follow";
  userId: string;
  contentId?: string;
  commentText?: string;
  timestamp: string;
}

const ActivityItem = ({
  type,
  userId,
  contentId,
  commentText,
  timestamp,
}: ActivityItemProps) => {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 24 * 7) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = () => {
    switch (type) {
      case "like":
        return <Heart className="w-5 h-5 text-red-500" />;
      case "comment":
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case "follow":
        return <UserPlus className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getActivityText = () => {
    switch (type) {
      case "like":
        return "liked your post";
      case "comment":
        return commentText
          ? `commented: "${commentText}"`
          : "commented on your post";
      case "follow":
        return "started following you";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center space-x-3 px-4 py-3 hover:bg-[#26A69A]/10">
      <PetAvatar name="User" size="md" />

      <div className="flex-1">
        <div className="flex items-center space-x-2">
          {getActivityIcon()}
          <Link to={`/user/${userId}`} className="font-semibold text-sm">
            User
          </Link>
          <span className="text-sm text-muted-foreground">
            {getActivityText()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatTimestamp(timestamp)}
        </p>
      </div>

      {contentId && type !== "follow" && (
        <Link to={`/post/${contentId}`} className="w-10 h-10">
          <div className="w-10 h-10 bg-muted rounded-lg"></div>
        </Link>
      )}
    </div>
  );
};

export default ActivityItem;
