import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

type Post = Tables<"posts"> & {
  profiles: Pick<
    Tables<"profiles">,
    "username" | "full_name" | "avatar_url"
  > | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

export const usePosts = () => {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!posts || posts.length === 0) return [] as Post[];

      const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
      const postIds = posts.map((p) => p.id);

      // Two batched queries instead of N+1
      const [profilesRes, likesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds),
        user.user
          ? supabase
              .from("likes")
              .select("post_id")
              .eq("user_id", user.user.id)
              .in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => [p.id, p])
      );
      const likedSet = new Set((likesRes.data || []).map((l) => l.post_id));

      return posts.map((post) => {
        const profile = profileMap.get(post.user_id) || null;
        const displayName =
          profile?.full_name?.trim() || profile?.username?.trim() || null;
        return {
          ...post,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          is_liked: likedSet.has(post.id),
          profiles: profile
            ? {
                username: displayName || profile.username,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
            : null,
        };
      }) as Post[];
    },
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postData: TablesInsert<"posts">) => {
      const { data, error } = await supabase
        .from("posts")
        .insert(postData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      isLiked,
    }: {
      postId: string;
      isLiked: boolean;
    }) => {
      // Use cached session — avoids extra network roundtrip per like
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Optimistically update the cache first
      const previousData = queryClient.getQueryData<Post[]>(["posts"]);

      queryClient.setQueryData<Post[]>(["posts"], (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes_count: isLiked
                  ? post.likes_count - 1
                  : post.likes_count + 1,
                is_liked: !isLiked,
              }
            : post
        );
      });

      try {
        if (isLiked) {
          const { error } = await supabase
            .from("likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("likes").insert({
            post_id: postId,
            user_id: userId,
          });
          if (error) throw error;
          
          // Push notifications disabled for now
          // try {
          //   const currentData = queryClient.getQueryData<Post[]>(["posts"]);
          //   const post = currentData?.find((p) => p.id === postId);
          //   
          //   if (post && post.user_id !== user.user.id) {
          //     const { data: likerProfile } = await supabase
          //       .from('profiles')
          //       .select('username, full_name')
          //       .eq('id', user.user.id)
          //       .single();
          //     
          //     const likerName = likerProfile?.full_name || likerProfile?.username || 'Someone';
          //     
          //     await supabase.functions.invoke('send-push', {
          //       body: {
          //         userId: post.user_id,
          //         title: `${likerName} liked your post`,
          //         body: post.caption ? 
          //           (post.caption.length > 50 ? post.caption.substring(0, 50) + '...' : post.caption) : 
          //           'Your post received a new like!',
          //         data: { type: 'like', postId, likerId: user.user.id }
          //       }
          //     });
          //   }
          // } catch (pushError) {
          //   console.error('Failed to send push notification:', pushError);
          // }
        }

        // Return the optimistic values
        const currentData = queryClient.getQueryData<Post[]>(["posts"]);
        const updatedPost = currentData?.find((post) => post.id === postId);

        return {
          likes: updatedPost?.likes_count || 0,
          isLiked: updatedPost?.is_liked || false,
        };
      } catch (error) {
        // Revert optimistic update on error
        queryClient.setQueryData<Post[]>(["posts"], previousData);
        throw error;
      }
    },
  });
};
