// src/components/reels/ReelOverlay.tsx
//
// Right-rail actions + bottom-left caption block + comments drawer for a
// single reel slide. Kept presentation-only; ReelSlide owns the like
// mutation and the playback state. ReelOverlay calls back via callbacks.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, Send } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import PetAvatar from "@/components/PetAvatar";
import ReportButton from "@/components/ReportButton";
import CommentItem from "@/components/CommentItem";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { useAuth } from "@/contexts/AuthContext";
import type { Reel } from "@/hooks/useReels";

interface ReelOverlayProps {
  reel: Reel;
  isLiked: boolean;
  likesCount: number;
  onLikeClick: () => void;
  onDrawerOpenChange: (open: boolean) => void;
  drawerOpen: boolean;
}

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const ReelOverlay = ({
  reel,
  isLiked,
  likesCount,
  onLikeClick,
  onDrawerOpenChange,
  drawerOpen,
}: ReelOverlayProps) => {
  const { user } = useAuth();
  const username =
    reel.profiles?.username?.trim() ||
    reel.profiles?.full_name?.trim() ||
    "User";
  const caption = reel.caption?.trim();

  return (
    <>
      {/* RIGHT RAIL — sits above the navbar (which is z-30). We use z-25
         so the heart-pop (z-30) still wins over the rail. */}
      <div
        className="absolute right-3 z-[25] flex flex-col items-center gap-5 pointer-events-auto"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={onLikeClick}
          aria-label={isLiked ? "Unlike" : "Like"}
          className="flex flex-col items-center group active:scale-95 transition-transform"
        >
          <Heart
            className={`w-8 h-8 drop-shadow-lg transition-colors ${
              isLiked
                ? "fill-red-500 text-red-500"
                : "fill-white/10 text-white"
            }`}
            strokeWidth={2}
          />
          <span className="text-white text-xs font-medium mt-1 drop-shadow-md">
            {formatCount(likesCount)}
          </span>
        </button>

        <button
          onClick={() => onDrawerOpenChange(true)}
          aria-label="Open comments"
          className="flex flex-col items-center group active:scale-95 transition-transform"
        >
          <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-white text-xs font-medium mt-1 drop-shadow-md">
            {formatCount(reel.comments_count)}
          </span>
        </button>

        <button
          onClick={() =>
            toast.info("Sharing is coming soon — Phase 3.")
          }
          aria-label="Share reel"
          className="flex flex-col items-center group active:scale-95 transition-transform"
        >
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" />
        </button>

        <ReportButton
          postId={reel.id}
          postOwnerId={reel.user_id}
          iconClassName="w-8 h-8 text-white drop-shadow-lg"
        />
      </div>

      {/* BOTTOM-LEFT — author + caption. Reserves room on the right for the rail. */}
      <div
        className="absolute left-4 right-20 z-[25] text-white pointer-events-auto"
        style={{
          bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <Link
          to={`/user/${reel.user_id}`}
          className="flex items-center gap-2 mb-2"
        >
          <PetAvatar
            src={reel.profiles?.avatar_url ?? undefined}
            name={username}
            size="sm"
          />
          <span className="font-semibold text-sm drop-shadow-md">
            @{username}
          </span>
        </Link>
        {caption && (
          <p className="text-sm leading-snug drop-shadow-md line-clamp-3">
            {caption}
          </p>
        )}
      </div>

      {/* COMMENTS DRAWER — vaul-based. Opening pauses the video via the
         `onDrawerOpenChange` callback into ReelSlide. */}
      <Drawer
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
        modal
      >
        <DrawerContent className="max-h-[80vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Comments</DrawerTitle>
          </DrawerHeader>
          <CommentsBody reelId={reel.id} currentUserId={user?.id ?? null} />
        </DrawerContent>
      </Drawer>
    </>
  );
};

// Body of the drawer — kept as a child so the `useComments` query doesn't
// fire until the drawer actually opens (the drawer mounts children lazily).
const CommentsBody = ({
  reelId,
  currentUserId,
}: {
  reelId: string;
  currentUserId: string | null;
}) => {
  const { data: comments, isLoading } = useComments(reelId);
  const { mutate: createComment, isPending } = useCreateComment();
  const [newComment, setNewComment] = useState("");

  const submit = () => {
    const text = newComment.trim();
    if (!text || !currentUserId) return;
    createComment(
      { post_id: reelId, user_id: currentUserId, text },
      {
        onSuccess: () => setNewComment(""),
        onError: () =>
          toast.error("Couldn't post comment. Please try again."),
      },
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-4">
      <div className="flex-1 overflow-y-auto space-y-3 py-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading comments…
          </p>
        ) : comments && comments.length > 0 ? (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              id={c.id}
              userId={c.user_id}
              username={
                c.profiles?.username?.trim() ||
                c.profiles?.full_name?.trim() ||
                "User"
              }
              avatarUrl={c.profiles?.avatar_url}
              text={c.text}
              timestamp={c.created_at}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 pt-3 border-t">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={!currentUserId}
        />
        <Button
          onClick={submit}
          disabled={!newComment.trim() || isPending || !currentUserId}
          size="sm"
          className="bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ReelOverlay;
