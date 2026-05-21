import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUsernameCheck = (username: string) => {
  return useQuery({
    queryKey: ['username-check', username],
    queryFn: async () => {
      if (!username || username.length < 3) return { available: true, suggestions: [] };
      
      // Use maybeSingle() for Safari compatibility
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error('Username check error:', error);
        throw error;
      }
      
      // If no data, username is available
      if (!data) {
        return { available: true, suggestions: [] };
      }
      
      // Username exists - not available
      return { available: false, suggestions: [] };
    },
    enabled: !!username && username.length >= 3,
  });
};

export const generateUsernameSuggestions = (fullName: string, existingUsername?: string): string[] => {
  if (!fullName) return [];
  
  const cleanName = fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = cleanName.split(' ').filter(word => word.length > 0);
  
  const suggestions: string[] = [];
  
  if (words.length >= 2) {
    const firstName = words[0];
    const lastName = words[words.length - 1];
    
    // Generate various combinations
    suggestions.push(
      `${firstName}${lastName}`,
      `${firstName}_${lastName}`,
      `${firstName}.${lastName}`,
      `${firstName}${lastName}${Math.floor(Math.random() * 100)}`,
      `${firstName}_${Math.floor(Math.random() * 1000)}`,
      `${lastName}_${firstName}`,
      firstName + Math.floor(Math.random() * 10000),
      lastName + Math.floor(Math.random() * 10000)
    );
  } else if (words.length === 1) {
    const name = words[0];
    suggestions.push(
      name + Math.floor(Math.random() * 1000),
      name + '_' + Math.floor(Math.random() * 100),
      'the_' + name,
      name + '_official',
      name + Math.floor(Math.random() * 10000)
    );
  }
  
  // Add some creative suggestions
  const emojis = ['🐕', '🐱', '🐾', '❤️', '✨', '🌟', '🎯', '🚀'];
  suggestions.push(
    words[0] + emojis[Math.floor(Math.random() * emojis.length)],
    emojis[Math.floor(Math.random() * emojis.length)] + words[0]
  );
  
  return suggestions.slice(0, 5).filter(s => s !== existingUsername);
};