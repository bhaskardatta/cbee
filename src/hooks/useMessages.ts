import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_url?: string;
  media_type?: "image" | "video" | "gif" | "sticker";
  sender?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  receiver?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export const useMessages = (otherUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !otherUserId) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id}))`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', otherUserId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, queryClient]);

  return useQuery({
    queryKey: ['messages', otherUserId],
    queryFn: async () => {
      if (!user || !otherUserId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(username, full_name, avatar_url),
          receiver:profiles!receiver_id(username, full_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user && !!otherUserId,
  });
};

export const useSendMessage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      receiverId, 
      content,
      mediaUrl,
      mediaType
    }: { 
      receiverId: string; 
      content: string;
      mediaUrl?: string;
      mediaType?: "image" | "video" | "gif" | "sticker";
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      const messageData: any = {
        sender_id: user.id,
        receiver_id: receiverId,
        content: content.trim(),
      };

      if (mediaUrl && mediaType) {
        messageData.media_url = mediaUrl;
        messageData.media_type = mediaType;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Push notifications disabled for now
      // try {
      //   const { data: senderProfile } = await supabase
      //     .from('profiles')
      //     .select('username, full_name')
      //     .eq('id', user.id)
      //     .single();
      //   
      //   const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';
      //   
      //   await supabase.functions.invoke('send-push', {
      //     body: {
      //       userId: receiverId,
      //       title: `New message from ${senderName}`,
      //       body: content.length > 50 ? content.substring(0, 50) + '...' : content,
      //       data: { type: 'message', senderId: user.id }
      //     }
      //   });
      // } catch (pushError) {
      //   console.error('Failed to send push notification:', pushError);
      // }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.receiverId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useConversations = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!user) return [];

      // Get users that the current user follows
      const { data: following, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingError) throw followingError;

      // Get users that follow the current user
      const { data: followers, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followersError) throw followersError;

      // Find mutual follows (users that both follow each other)
      const followingIds = following?.map(f => f.following_id) || [];
      const followerIds = followers?.map(f => f.follower_id) || [];
      const mutualUserIds = followingIds.filter(id => followerIds.includes(id));

      if (mutualUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, username, full_name, avatar_url),
          receiver:profiles!receiver_id(id, username, full_name, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation partner and filter for mutual follows
      const conversationsMap = new Map();
      
      data.forEach((message: any) => {
        const otherUser = message.sender_id === user.id ? message.receiver : message.sender;
        const key = otherUser.id;
        
        // Only include if mutual follow
        if (!mutualUserIds.includes(key)) return;
        
        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            user: otherUser,
            lastMessage: message,
            unreadCount: 0,
          });
        }
        
        // Count unread messages
        if (message.receiver_id === user.id && !message.is_read) {
          conversationsMap.get(key).unreadCount++;
        }
      });

      return Array.from(conversationsMap.values());
    },
    enabled: !!user,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};