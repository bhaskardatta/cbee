
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

type Comment = Tables<"comments"> & {
  profiles: Pick<
    Tables<"profiles">,
    "username" | "full_name" | "avatar_url"
  > | null;
};

type Post = Tables<"posts"> & {
  profiles: Pick<
    Tables<"profiles">,
    "username" | "full_name" | "avatar_url"
  > | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

export const useComments = (postId: string) => {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data: comments, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const commentsWithProfiles = await Promise.all(
        comments.map(async (comment) => {
          // Use maybeSingle() for Safari compatibility
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", comment.user_id)
            .maybeSingle();

          if (error) {
            console.error('Profile fetch error for comment:', comment.id, error);
          }

          return {
            ...comment,
            profiles: profile || null,
          };
        })
      );

      return commentsWithProfiles as Comment[];
    },
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentData: TablesInsert<"comments">) => {
      const { data, error } = await supabase
        .from("comments")
        .insert(commentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (newComment, variables) => {
      const postId = variables.post_id;

      // ✅ Refresh only the comments for the post
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });

      // ✅ Optimistically update comment count for only the specific post
      queryClient.setQueryData<Post[]>(["posts"], (old) => {
        if (!old) return old;
        return old.map((post) =>
          post.id === postId
            ? { ...post, comments_count: post.comments_count + 1 }
            : post
        );
      });
      
      // Send push notification to post owner
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;
        
        const postsData = queryClient.getQueryData<Post[]>(["posts"]);
        const post = postsData?.find((p) => p.id === postId);
        
        if (post && post.user_id !== user.user.id) {
          // Use maybeSingle() for Safari compatibility
          const { data: commenterProfile } = await supabase
            .from('profiles')
            .select('username, full_name')
            .eq('id', user.user.id)
            .maybeSingle();
          
          const commenterName = commenterProfile?.full_name || commenterProfile?.username || 'Someone';
          
          await supabase.functions.invoke('send-push', {
            body: {
              userId: post.user_id,
              title: `${commenterName} commented on your post`,
              body: variables.text.length > 50 ? 
                variables.text.substring(0, 50) + '...' : 
                variables.text,
              data: { type: 'comment', postId, commenterId: user.user.id }
            }
          });
        }
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
      }
    },
  });
};
