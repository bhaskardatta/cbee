import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import { usePosts } from "@/hooks/usePosts";
import Lottie from "lottie-react";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import OfflineAnimation from "@/components/ui/offline.json";
import { useTheme } from "next-themes";

const HomePage = () => {
  const { data: posts, isLoading, error } = usePosts();
  const { theme } = useTheme();

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
      <AppHeader showMessagesAndFeedback />
        <div className="flex-grow flex flex-col items-center justify-center px-4 relative">
          <p className="text-destructive text-center text-lg font-semibold mb-6">
            Check your internet connection.
          </p>
          <Lottie
            animationData={OfflineAnimation}
            loop
            autoplay
            className="w-80 h-80"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader showMessagesAndFeedback />
      <Layout>
        <div className="content-container px-4 pb-4 animate-fade-in">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <Lottie
              animationData={
                theme === "dark" ? DarkLoaderAnimation : LoaderAnimation
              }
              loop
              autoplay
              className="w-80 h-80 animate-pulse"
            />
          </div>
        ) : posts && posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              userId={post.user_id}
              type={post.type as "photo" | "video"}
              media={post.media_url}
              caption={post.caption || ""}
              location={post.location || ""}
              likes={post.likes_count}
              comments={post.comments_count}
              timestamp={post.created_at}
              hashtags={post.hashtags || []}
              username={post.profiles?.username?.trim() || post.profiles?.full_name?.trim() || undefined}
              avatarUrl={post.profiles?.avatar_url || undefined}
              is_liked={post.is_liked}
              className="bg-transparent"
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-primary"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">No Posts Yet</h3>
            <p className="text-sm text-muted-foreground text-center">
              Be the first to share your pet's moments!
            </p>
          </div>
        )}
        </div>
      </Layout>
    </>
  );
};

export default HomePage;
