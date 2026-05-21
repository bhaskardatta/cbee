import { useState, useEffect } from "react";
import { MessageCircle, MoreHorizontal, Trash } from "lucide-react";
import { Link } from "react-router-dom";
import { useLikePost, useDeletePost } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { colorClasses } from "@/lib/theme";
import HeartAnimation from "./HeartAnimation";
import ReportButton from "./ReportButton";
import InlineFeedVideo from "./InlineFeedVideo";
import Lottie from "lottie-react";
import Like_anime from "@/components/ui/heart_animation_like.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PetAvatar from "./PetAvatar";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import OptimizedImage from "./OptimizedImage";

interface PostCardProps {
  id: string;
  userId: string;
  type: "photo" | "video";
  media: string;
  caption: string;
  location: string;
  likes: number;
  comments: number;
  timestamp: string;
  hashtags: string[];
  username?: string;
  avatarUrl?: string;
  className?: string;
  is_liked?: boolean;
}

const PostCard = ({
  id,
  userId,
  type,
  media,
  caption,
  location,
  likes,
  comments,
  timestamp,
  hashtags,
  username,
  avatarUrl,
  className,
  is_liked = false,
}: PostCardProps) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(is_liked);
  const [likesCount, setLikesCount] = useState(likes);
  const { mutate: likePost } = useLikePost();
  const { mutate: deletePost } = useDeletePost();

  const isOwner = user?.id === userId;
  // Fallback chain: username -> treat empty string as missing -> "User"
  const displayUsername = (username && username.trim()) || "User";

  const [playAnimation, setPlayAnimation] = useState(false);

  useEffect(() => {
    setLikesCount(likes);
    setIsLiked(is_liked);
  }, [likes, is_liked]);

  const handleLike = () => {
    if (!user) {
      toast("Please log in to like posts");
      return;
    }

    // Instant UI feedback — don't wait for server roundtrip
    const willLike = !isLiked;
    setIsLiked(willLike);
    setLikesCount((c) => c + (willLike ? 1 : -1));
    if (willLike) {
      setPlayAnimation(true);
      if (navigator.vibrate) navigator.vibrate(150);
      setTimeout(() => setPlayAnimation(false), 1000);
    }

    likePost(
      { postId: id, isLiked },
      {
        onSuccess: (data) => {
          // Reconcile with server result
          setIsLiked(data.isLiked);
          setLikesCount(data.likes);
        },
        onError: () => {
          // Revert on failure
          setIsLiked(!willLike);
          setLikesCount((c) => c + (willLike ? -1 : 1));
          toast("Failed to update like");
        },
      }
    );
  };

  const handleDelete = () => {
    if (!isOwner) return;

    deletePost(id, {
      onSuccess: () => {
        toast("Post deleted successfully");
      },
      onError: () => {
        toast("Failed to delete post");
      },
    });
  };

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

  return (
    <div className={cn("border-b border-border pb-4 mb-4 select-none", className)}>
      {/* Animation Layer */}
      {playAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 xl:w-56 xl:h-56">
            <Lottie
              animationData={Like_anime}
              loop
              autoplay
              className="w-48 h-48"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 select-none">
        <Link to={`/user/${userId}`} className="flex items-center space-x-3 select-none">
          <PetAvatar src={avatarUrl} name={displayUsername} size="sm" />
          <div className="select-none">
            <p className="font-semibold text-sm select-none">{displayUsername}</p>
            {location && (
              <p className="text-xs text-muted-foreground select-none">{location}</p>
            )}
          </div>
        </Link>
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 select-none">
                <MoreHorizontal className="w-5 h-5 text-muted-foreground select-none" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <ReportButton
            postId={id}
            postOwnerId={userId}
            iconClassName="w-5 h-5 text-muted-foreground"
          />
        )}
      </div>

      {/* Media */}
      {type === "photo" ? (
        <div
          className="mb-3 rounded-lg overflow-hidden cursor-pointer select-none"
          onDoubleClick={handleLike}
        >
          <OptimizedImage
            src={media}
            alt="Post content"
            className="w-full h-auto object-contain max-h-96"
            containerClassName="w-full"
          />
        </div>
      ) : (
        // Instagram-style inline video — auto-play muted when visible,
        // tap opens it in the immersive Reels view.
        <div className="mb-3 select-none">
          <InlineFeedVideo
            postId={id}
            src={media}
            onDoubleClick={handleLike}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center space-x-4 select-none">
          <HeartAnimation isLiked={isLiked} onClick={handleLike} size="md" />
          <Link to={`/post/${id}`} className="flex items-center space-x-1 select-none">
            <MessageCircle className="w-6 h-6 text-foreground select-none" />
          </Link>
        </div>
      </div>

      {/* Likes and Comments */}
      <div className="mb-2 select-none">
        <p className="font-semibold text-sm select-none">{likesCount} likes</p>
        <Link to={`/post/${id}`} className="text-sm text-muted-foreground select-none">
          View all {comments} comments
        </Link>
      </div>

      {/* Caption */}
      {caption && (
        <div className="mb-1">
          <p className="text-sm select-text">
            <span className="font-semibold mr-2 select-text">{displayUsername}</span>
            {caption}
          </p>
        </div>
      )}

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <div className="mb-1 select-none">
          <p className={cn("text-sm select-none", colorClasses.primary)}>
            {hashtags.map((tag) => `#${tag}`).join(" ")}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground uppercase select-none">
        {formatTimestamp(timestamp)}
      </p>
    </div>
  );
};

export default PostCard;
