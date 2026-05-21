import { useState } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import CommentItem from "@/components/CommentItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoaderAnimation from "@/components/ui/cbee_loding.json";

import {
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Trash,
} from "lucide-react";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { usePosts, useLikePost, useDeletePost } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");

  const { data: posts } = usePosts();
  const { data: comments, isLoading } = useComments(postId || "");
  const { mutate: createComment, isPending: isCommenting } = useCreateComment();
  const { mutate: likePost } = useLikePost();
  const { mutate: deletePost } = useDeletePost();

  // Find the current post
  const currentPost = posts?.find((post) => post.id === postId);

  const [isLiked, setIsLiked] = useState(currentPost?.is_liked || false);
  const [likesCount, setLikesCount] = useState(currentPost?.likes_count || 0);

  const isOwner = user?.id === currentPost?.user_id;
  const displayUsername =
    currentPost?.profiles?.username ||
    currentPost?.profiles?.full_name ||
    "User";

  const handleAddComment = () => {
    if (!newComment.trim() || !user || !postId) {
      toast("Please enter a comment");
      return;
    }

    createComment(
      {
        post_id: postId,
        user_id: user.id,
        text: newComment.trim(),
      },
      {
        onSuccess: () => {
          setNewComment("");
          toast("Comment added!");
        },
        onError: () => {
          toast("Failed to add comment");
        },
      }
    );
  };

  const handleLike = () => {
    if (!user || !postId) {
      toast("Please log in to like posts");
      return;
    }

    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount((prev) => (newIsLiked ? prev + 1 : prev - 1));

    likePost({ postId, isLiked });
  };

  const handleDelete = () => {
    if (!isOwner || !postId) return;

    deletePost(postId, {
      onSuccess: () => {
        toast("Post deleted successfully");
        // Navigate back after deletion
        window.history.back();
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

  if (!currentPost) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Post" showBackButton />
        <Layout>
          <div className="px-4 flex items-center justify-center min-h-[50vh]">
            <p className="text-gray-500">Post not found</p>
          </div>
        </Layout>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Post" showBackButton />
      <Layout>
        <div className="px-4">
        {/* Post Content */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#26A69A]/20 rounded-full flex items-center justify-center">
                <span className="text-[#26A69A] font-semibold">
                  {displayUsername[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold">{displayUsername}</p>
                {currentPost.location && (
                  <p className="text-xs text-gray-500">
                    {currentPost.location}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {formatTimestamp(currentPost.created_at)}
                </p>
              </div>
            </div>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1">
                    <MoreHorizontal className="w-5 h-5 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Media - Full responsive display */}
          <div className="mb-3 rounded-lg overflow-hidden">
            {currentPost.type === "photo" ? (
              <img
                src={currentPost.media_url}
                alt="Post content"
                className="w-full h-auto object-contain max-h-96"
              />
            ) : (
              <video
                src={currentPost.media_url}
                controls
                className="w-full h-auto object-contain max-h-96"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLike}
                className="flex items-center space-x-1"
              >
                <Heart
                  className={cn(
                    "w-6 h-6",
                    isLiked ? "fill-red-500 text-red-500" : "text-gray-700"
                  )}
                />
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-1"
              >
                <MessageCircle className="w-6 h-6 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Likes and Caption */}
          <div className="space-y-1">
            <p className="font-semibold text-sm">{likesCount} likes</p>
            {currentPost.caption && (
              <p className="text-sm">
                <span className="font-semibold mr-2">{displayUsername}</span>
                {currentPost.caption}
              </p>
            )}
            {currentPost.hashtags && currentPost.hashtags.length > 0 && (
              <p className="text-sm text-primary">
                {currentPost.hashtags.map((tag) => `#${tag}`).join(" ")}
              </p>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-4">
          <h3 className="font-semibold">
            Comments {comments ? `(${comments.length})` : ""}
          </h3>

          {/* Comments List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="text-gray-500 text-center py-4">
                Loading comments...
              </p>
            ) : comments && comments.length > 0 ? (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  id={comment.id}
                  userId={comment.user_id}
                  username={
                    comment.profiles?.username?.trim() ||
                    comment.profiles?.full_name?.trim() ||
                    "User"
                  }
                  avatarUrl={comment.profiles?.avatar_url}
                  text={comment.text}
                  timestamp={comment.created_at}
                />
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>

          {/* Add Comment */}
          <div className="flex items-center space-x-2 pt-4 border-t">
            <div className="w-8 h-8 bg-[#26A69A]/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-[#26A69A] font-semibold text-xs">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1"
              onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isCommenting}
              size="sm"
              className="bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        </div>
      </Layout>
    </div>
  );
};

export default PostDetailPage;
