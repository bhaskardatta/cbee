import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getVerifiedSession } from '@/integrations/supabase/auth-helpers';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';

type ProfileWithCounts = Tables<'profiles'> & {
  followers_count: number;
  following_count: number;
  posts_count: number;
};

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      // If no profile exists, return null to trigger profile creation
      if (!profile) {
        return null;
      }

      return {
        ...profile,
        followers_count: profile.followers_count || 0,
        following_count: profile.following_count || 0,
        posts_count: profile.posts_count || 0
      } as ProfileWithCounts;
    },
    enabled: !!userId,
  });
};

// Helper function to sanitize string fields - trim and convert empty to null
const sanitizeStringField = (value: string | undefined | null): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: TablesUpdate<'profiles'> }) => {
      // Ensure we have a valid userId
      if (!userId) {
        throw new Error('User ID is required');
      }

      // CRITICAL: Verify authentication before any database operation (iOS Safari fix)
      // Uses getUser() as fallback when localStorage is unreliable
      const session = await getVerifiedSession();
      if (!session?.user?.id) {
        console.error('[iOS Profile Update] No authenticated session after server verification - blocking update');
        throw new Error('Authentication required. Please log out and log back in, then try again.');
      }

      // Verify the authenticated user matches the profile being updated
      if (session.user.id !== userId) {
        console.error('[iOS Profile Update] User ID mismatch:', { sessionUserId: session.user.id, requestedUserId: userId });
        throw new Error('You can only update your own profile.');
      }

      console.log('[iOS Profile Update] Starting update for user:', userId);
      console.log('[iOS Profile Update] Raw updates:', updates);

      // Sanitize all string fields - trim and convert empty strings to null
      const cleanUpdates: TablesUpdate<'profiles'> = {};
      
      if (updates.username !== undefined) {
        cleanUpdates.username = sanitizeStringField(updates.username);
      }
      if (updates.full_name !== undefined) {
        cleanUpdates.full_name = sanitizeStringField(updates.full_name);
      }
      if (updates.bio !== undefined) {
        cleanUpdates.bio = sanitizeStringField(updates.bio);
      }
      if (updates.avatar_url !== undefined) {
        cleanUpdates.avatar_url = updates.avatar_url;
      }

      console.log('[iOS Profile Update] Sanitized updates:', cleanUpdates);

      // Check if there's anything to update
      if (Object.keys(cleanUpdates).length === 0) {
        console.warn('[iOS Profile Update] No fields to update after sanitization');
        throw new Error('No changes to save.');
      }

      // Check if username is being updated and if it's already taken
      if (cleanUpdates.username) {
        const checkResult = await supabase
          .from('profiles')
          .select('id, username')
          .eq('username', cleanUpdates.username)
          .neq('id', userId)
          .maybeSingle();
        
        if (checkResult.error) {
          console.error('[iOS Profile Update] Username check error:', checkResult.error);
          throw checkResult.error;
        }
        
        if (checkResult.data) {
          const error = new Error('Username already taken') as Error & { code: string; suggestions: string[] };
          error.code = 'USERNAME_TAKEN';
          
          // Generate 2 suggestions based on the username
          const baseUsername = cleanUpdates.username.replace(/[0-9_]+$/, '');
          const suggestions = [
            `${baseUsername}_${Math.floor(Math.random() * 100)}`,
            `${baseUsername}${Math.floor(Math.random() * 1000)}`
          ];
          error.suggestions = suggestions;
          
          throw error;
        }
      }
      
      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      console.log('[iOS Profile Update] Existing profile check:', existingProfile);
      
      let updateData;
      let updateError;
      
      if (!existingProfile) {
        // Profile doesn't exist - create it (INSERT)
        console.log('[iOS Profile Update] Profile not found, creating new profile...');
        
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            ...cleanUpdates
          })
          .select('*')
          .maybeSingle();
        
        updateData = data;
        updateError = error;
      } else {
        // Profile exists - update it (UPDATE)
        console.log('[iOS Profile Update] Executing database update...');
        
        const { data, error } = await supabase
          .from('profiles')
          .update(cleanUpdates)
          .eq('id', userId)
          .select('*')
          .maybeSingle();
        
        updateData = data;
        updateError = error;
      }
      
      console.log('[iOS Profile Update] Database response:', { 
        data: updateData, 
        error: updateError, 
        hasData: !!updateData 
      });
      
      if (updateError) {
        console.error('[iOS Profile Update] Database error:', updateError);
        throw updateError;
      }
      
      // CRITICAL: If no data returned, the operation failed (likely RLS issue or no matching row)
      if (!updateData) {
        console.error('[iOS Profile Update] Operation returned null - RLS may have blocked the write');
        throw new Error('Profile update failed - your session may have expired. Please refresh the page and try again.');
      }
      
      console.log('[iOS Profile Update] SUCCESS - Profile data:', updateData);
      return updateData;
    },
    onSuccess: (data, variables) => {
      console.log('[iOS Profile Update] Mutation succeeded, invalidating queries...');
      
      // Only invalidate and refetch after confirmed successful database update
      // Do NOT use setQueryData - let the refetch get fresh data from the database
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
      
      // Force refetch to ensure UI shows actual database state
      queryClient.refetchQueries({ queryKey: ['profile', variables.userId] });
    },
    onError: (error) => {
      console.error('[iOS Profile Update] Mutation failed:', error);
    }
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) => {
      // Verify authentication first (Safari fix)
      const session = await getVerifiedSession();
      if (!session?.user?.id) {
        throw new Error('You must be logged in to follow users.');
      }

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('following_id', targetUserId);
        
        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: session.user.id,
            following_id: targetUserId
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.targetUserId] });
    },
  });
};

export const useIsFollowing = (targetUserId: string | undefined) => {
  return useQuery({
    queryKey: ['is-following', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return false;
      
      const session = await getVerifiedSession();
      if (!session?.user?.id) return false;

      // Use maybeSingle() for Safari compatibility
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', session.user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (error) {
        console.error('Follow check error:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!targetUserId,
  });
};
