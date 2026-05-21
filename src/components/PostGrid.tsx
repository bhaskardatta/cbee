import { Heart, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import OptimizedImage from "./OptimizedImage";

interface PostGridProps {
  posts: Array<{
    id: string;
    type: "photo" | "video";
    media_url: string;
    likes_count: number;
    comments_count: number;
  }>;
}

const PostGrid = ({ posts }: PostGridProps) => {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-[#26A69A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-[#26A69A]" />
        </div>
        <h3 className="font-semibold mb-2">No Posts Yet</h3>
        <p className="text-muted-foreground text-sm">
          Start sharing your pet's moments!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post) => (
        <Link
          key={post.id}
          to={`/post/${post.id}`}
          className="relative aspect-square"
        >
          <div className="w-full h-full bg-muted rounded-lg overflow-hidden">
            {post.type === "photo" ? (
              <OptimizedImage
                src={post.media_url}
                alt="Post"
                className="w-full h-full object-cover"
                containerClassName="w-full h-full"
              />
            ) : (
              <video
                src={post.media_url}
                className="w-full h-full object-cover"
                muted
                preload="none"
              />
            )}
          </div>

          {/* Overlay with stats */}
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
            <div className="flex items-center space-x-4 text-white">
              <div className="flex items-center space-x-1">
                <Heart className="w-5 h-5 fill-white" />
                <span className="font-semibold">{post.likes_count}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-5 h-5 fill-white" />
                <span className="font-semibold">{post.comments_count}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default PostGrid;
