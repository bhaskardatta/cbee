import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import PostGrid from "@/components/PostGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import SignOutDialog from "@/components/SignOutDialog";

import {
  useProfile,
  useUpdateProfile,
  useFollowUser,
  useIsFollowing,
} from "@/hooks/useProfile";
import { useUserPosts } from "@/hooks/useUserPosts";
import { useUsernameCheck } from "@/hooks/useUsernameCheck";
import { Grid, Edit, Save, Camera, Check, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { colorClasses } from "@/lib/theme";
import PetAvatar from "@/components/PetAvatar";
import ProfilePhotoEditor from "@/components/ProfilePhotoEditor";
import Lottie from "lottie-react";
import { useTheme } from "next-themes";

const ProfilePage = () => {
  const { theme } = useTheme();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isOwnProfile = userId === "me" || userId === user?.id;
  const actualUserId = userId === "me" ? user?.id : userId;

  console.log("ProfilePage - actualUserId:", actualUserId);
  console.log("ProfilePage - user:", user);

  const { data: profile, isLoading } = useProfile(actualUserId);
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useUserPosts(actualUserId);
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: followUser } = useFollowUser();
  const { data: isFollowing } = useIsFollowing(actualUserId);

  console.log("ProfilePage - posts data:", posts);
  console.log("ProfilePage - posts loading:", postsLoading);
  console.log("ProfilePage - posts error:", postsError);

  const [isEditing, setIsEditing] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [editData, setEditData] = useState({
    username: "",
    full_name: "",
    bio: "",
  });
  const [debouncedUsername, setDebouncedUsername] = useState("");

  // Debounce username input for availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(editData.username);
    }, 500);
    return () => clearTimeout(timer);
  }, [editData.username]);

  const isUsernameChanged = editData.username !== profile?.username;
  const { data: usernameCheck, isLoading: isCheckingUsername } =
    useUsernameCheck(isUsernameChanged ? debouncedUsername : "");

  const handleEdit = () => {
    setEditData({
      username: profile?.username || "",
      full_name: profile?.full_name || "",
      bio: profile?.bio || "",
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!actualUserId) {
      toast({
        title: "User ID not found",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    // Pass raw data - sanitization (trim + empty-to-null) is handled in the hook
    updateProfile(
      {
        userId: actualUserId,
        updates: {
          username: editData.username,
          full_name: editData.full_name,
          bio: editData.bio,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Profile updated successfully!",
            duration: 1500,
          });
          setIsEditing(false);
        },
        onError: (error: Error & { code?: string; suggestions?: string[] }) => {
          console.error('Profile update error:', error);
          if (error.code === "USERNAME_TAKEN" && error.suggestions) {
            toast({
              title: "Username already taken",
              description: `Try: ${error.suggestions.join(" or ")}`,
              variant: "destructive",
              duration: 4000,
            });
          } else {
            toast({
              title: "Failed to update profile",
              description: error.message || "Please try again",
              variant: "destructive",
              duration: 3000,
            });
          }
        },
      }
    );
  };

  const handleFollow = () => {
    if (!user || !actualUserId) {
      toast({
        title: "Please log in to follow users",
        variant: "destructive",
      });
      return;
    }

    followUser(
      {
        targetUserId: actualUserId,
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleOpenSignOutDialog = () => {
    setShowSignOutDialog(true);
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
          className="w-80 h-80"
        />
      </div>
    );
  }

  return (
    <>
      <AppHeader
        title={isOwnProfile ? "Space" : " User Space"}
        showBackButton={!isOwnProfile}
      />
      <Layout>
        <div className="px-4 py-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <PetAvatar
                src={profile?.avatar_url}
                name={profile?.username || profile?.full_name || "User"}
                size="xl"
              />
              {isOwnProfile && (
                <button
                  onClick={() => setShowPhotoEditor(true)}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center hover:bg-[#26A69A]/95 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editData.full_name}
                    onChange={(e) =>
                      setEditData({ ...editData, full_name: e.target.value })
                    }
                    placeholder="Full Name"
                  />
                  <div className="space-y-1">
                    <div className="relative">
                      <Input
                        value={editData.username}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            username: e.target.value.replace(
                              /[^a-zA-Z0-9_]/g,
                              ""
                            ),
                          })
                        }
                        placeholder="Username"
                        className={`pr-10 ${
                          isUsernameChanged &&
                          editData.username.length >= 3 &&
                          !isCheckingUsername &&
                          editData.username === debouncedUsername &&
                          !usernameCheck?.available
                            ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
                            : ""
                        }`}
                      />
                      {isUsernameChanged && editData.username.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isCheckingUsername ||
                          editData.username !== debouncedUsername ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : usernameCheck?.available ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Only letters, numbers, and underscores. No spaces.
                    </p>
                    {isUsernameChanged &&
                      editData.username.length >= 3 &&
                      !isCheckingUsername &&
                      editData.username === debouncedUsername &&
                      !usernameCheck?.available && (
                        <div className="text-xs text-muted-foreground">
                          <span className="text-red-500">Username taken.</span>{" "}
                          Try:{" "}
                          {[
                            `${editData.username}_${Math.floor(
                              Math.random() * 100
                            )}`,
                            `${editData.username}${Math.floor(
                              Math.random() * 1000
                            )}`,
                          ].map((suggestion, i) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() =>
                                setEditData({
                                  ...editData,
                                  username: suggestion,
                                })
                              }
                              className="text-primary hover:underline"
                            >
                              {suggestion}
                              {i === 0 ? ", " : ""}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold">
                    {profile?.full_name || "User Name"}
                  </h2>
                  <p className="text-gray-500">
                    @{profile?.username || "username"}
                  </p>
                </>
              )}

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
          <div className="mb-6">
            {isOwnProfile ? (
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={isPending}
                      className={`flex-1 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditData({
                          username: profile?.username || "",
                          full_name: profile?.full_name || "",
                          bio: profile?.bio || "",
                        });
                      }}
                      className={`${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className={`flex-1 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                      onClick={handleEdit}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                    <Button
                      className={`${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                      onClick={handleOpenSignOutDialog}
                    >
                      Sign Out
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex space-x-2">
                <Button
                  className={`flex-1 ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
                  onClick={handleFollow}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/messages/${actualUserId}`)}
                >
                  Message
                </Button>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="mb-6">
            {isEditing ? (
              <Textarea
                value={editData.bio}
                onChange={(e) =>
                  setEditData({ ...editData, bio: e.target.value })
                }
                placeholder="Write a bio..."
                className="resize-none"
                rows={3}
              />
            ) : (
              <p className="text-sm">
                {profile?.bio ? (
                  profile.bio
                ) : (
                  <>
                    Welcome to Cbee, This is your profile page <br />
                    Please take a moment to update your bio 🐕🐱
                  </>
                )}
              </p>
            )}
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
                <div className="text-muted-foreground">Loading posts...</div>
              </div>
            ) : postsError ? (
              <div className="text-center py-12">
                <div className="text-destructive">
                  Error loading posts: {postsError.message}
                </div>
              </div>
            ) : (
              <PostGrid posts={posts || []} />
            )}
          </div>

          <ProfilePhotoEditor
            isOpen={showPhotoEditor}
            onClose={() => setShowPhotoEditor(false)}
            currentAvatarUrl={profile?.avatar_url}
            onPhotoUpdate={(newUrl) => {
              // Force refresh to show updated photo with Safari-compatible delay
              requestAnimationFrame(() => {
                setTimeout(() => window.location.reload(), 500);
              });
            }}
          />

          <SignOutDialog
            isOpen={showSignOutDialog}
            onClose={() => setShowSignOutDialog(false)}
            onSignOut={handleSignOut}
            userId={actualUserId || ""}
          />
        </div>
      </Layout>
    </>
  );
};

export default ProfilePage;
