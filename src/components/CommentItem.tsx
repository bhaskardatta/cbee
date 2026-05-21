
import { Link } from "react-router-dom";
import PetAvatar from "./PetAvatar";

interface CommentItemProps {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  avatarUrl?: string | null;
}

const CommentItem = ({
  userId,
  username,
  text,
  timestamp,
  avatarUrl,
}: CommentItemProps) => {
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString();
  };

  const displayUsername = username || "User";
  // If we never got a real userId, don't render the link as /user/undefined
  const profileHref = userId ? `/user/${userId}` : "#";

  return (
    <div className="flex space-x-3 py-2">
      <Link to={profileHref} className="flex-shrink-0">
        <PetAvatar
          src={avatarUrl ?? undefined}
          name={displayUsername}
          size="sm"
        />
      </Link>

      <div className="flex-1">
        <div className="flex items-start space-x-2">
          <Link to={profileHref} className="font-semibold text-sm">
            {displayUsername}
          </Link>
          <span className="text-sm text-foreground">{text}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(timestamp)}</p>
      </div>
    </div>
  );
};

export default CommentItem;
