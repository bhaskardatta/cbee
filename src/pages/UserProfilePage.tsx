import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import PostGrid from "@/components/PostGrid";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import { useProfile, useFollowUser, useIsFollowing } from "@/hooks/useProfile";
import { useUserPosts } from "@/hooks/useUserPosts";
import { Grid, AudioLines } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { colorClasses } from "@/lib/theme";
import PetAvatar from "@/components/PetAvatar";
import Lottie from "lottie-react";
import { useTheme } from "next-themes";

const UserProfilePage = () => {
  const { theme } = useTheme();
  const { userId: rawUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Defensive: if some Link upstream built `/user/${undefined}` we end up
  // with the literal string "undefined" here, and any downstream call to
  // Postgres throws `invalid input syntax for type uuid: "undefined"`.
  // Treat that as a non-id and skip the queries — the empty state still
  // renders, just without a crash banner.
  const userId =
    rawUserId && rawUserId !== "undefined" && rawUserId !== "null"
      ? rawUserId
      : undefined;

  const { data: profile, isLoading } = useProfile(userId);
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useUserPosts(userId);
  const { mutate: followUser } = useFollowUser();
  const { data: isFollowing } = useIsFollowing(userId);

  const handleFollow = () => {
    if (!user || !userId) {
      toast({
        title: "Please log in to follow users",
        variant: "destructive",
      });
      return;
    }

    followUser(
      {
        targetUserId: userId,
        isFollowing: isFollowing || false,
      },
      {
        onSuccess: () => {
          toast({
            title: isFollowing
              ? "Unfollowed successfully!"
              : "Followed successfully!",
            duration: 1500,
          });
        },
        onError: () => {
          toast({
            title: "Failed to update follow status",
            variant: "destructive",
            duration: 1500,
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Lottie
          animationData={
            theme === "dark" ? DarkLoaderAnimation : LoaderAnimation
          }
          loop
          autoplay
          className="w-80 h-80 animate-fade-in"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader title={profile?.username || "User Profile"} showBackButton />

      <Layout>
      <div className="px-4 py-6 animate-fade-in">
        {/* Profile Header */}
        <div className="flex items-center space-x-4 mb-6">
          <PetAvatar
            src={profile?.avatar_url}
            name={profile?.username || profile?.full_name || "User"}
            size="xl"
          />

          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {profile?.full_name || "User Name"}
            </h2>
            <p className="text-gray-500">@{profile?.username || "username"}</p>

            <div className="flex space-x-6 mt-3">
              <div className="text-center">
                <span className="font-bold block">{posts?.length || 0}</span>
                <span className="text-sm text-gray-500">Posts</span>
              </div>
              <div className="text-center">
                <span className="font-bold block">
                  {profile?.followers_count || 0}
                </span>
                <span className="text-sm text-gray-500">Followers</span>
              </div>
              <div className="text-center">
                <span className="font-bold block">
                  {profile?.following_count || 0}
                </span>
                <span className="text-sm text-gray-500">Following</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex space-x-2">
          <Button
            className={`flex-1 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover} hover-scale transition-all duration-200`}
            onClick={handleFollow}
          >
            {isFollowing ? "Unfollow" : "Follow"}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/messages/${userId}`)}
            className={`${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
          >
            <AudioLines className={`w-4 h-4 mr-2 ${colorClasses.white}`} />
            Message
          </Button>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <p className="text-sm">
            {profile?.bio || "This user hasn't added a bio yet."}
          </p>
        </div>

        {/* Posts Grid */}
        <div>
          <div className="flex border-b border-border mb-4">
            <button
              className={`flex-1 pb-3 border-b-2 border-[${colorClasses.primary}]`}
            >
              <Grid className={`w-5 h-5 mx-auto ${colorClasses.primary}`} />
            </button>
          </div>

          {postsLoading ? (
            <div className="text-center py-12">
              <Lottie
                animationData={
                  theme === "dark" ? DarkLoaderAnimation : LoaderAnimation
                }
                loop
                autoplay
                className="w-20 h-20 mx-auto animate-pulse"
              />
              <div className="text-muted-foreground mt-2">Loading posts...</div>
            </div>
          ) : postsError ? (
            <div className="text-center py-12">
              <div className="text-destructive">
                Error loading posts: {postsError.message}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <PostGrid posts={posts || []} />
            </div>
          )}
        </div>
      </div>
      </Layout>
    </div>
  );
};

export default UserProfilePage;
