-- Reset all like and comment counts to 0
-- This will clear all existing likes and comments data

-- Delete all existing likes
DELETE FROM public.likes;

-- Delete all existing comments  
DELETE FROM public.comments;

-- Note: The counts are calculated dynamically in the app, so no need to update post records