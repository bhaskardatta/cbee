import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type UserPost = Tables<"posts"> & {
  likes_count: number;
  comments_count: number;
  type: "photo" | "video";
};

export const useUserPosts = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-posts", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");

      console.log("Fetching posts for user:", userId);

      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching posts:", error);
        throw error;
      }

      console.log("Raw posts data:", posts);

      if (!posts || posts.length === 0) {
        console.log("No posts found for user");
        return [];
      }

      // Use cached counts from posts table
      const postsWithCounts = posts.map((post) => {
        const processedPost = {
          ...post,
          type:
            post.type === "photo" || post.type === "video"
              ? post.type
              : ("photo" as "photo" | "video"),
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
        };

        console.log("Processed post:", processedPost);
        return processedPost;
      });

      console.log("Final posts with counts:", postsWithCounts);
      return postsWithCounts as UserPost[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};
