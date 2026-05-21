-- Clear all data from the app for release

-- Delete all data from child tables first
DELETE FROM public.likes;
DELETE FROM public.comments;
DELETE FROM public.follows;
DELETE FROM public.messages;
DELETE FROM public.search_history;
DELETE FROM public.push_subscriptions;
DELETE FROM public.orders;
DELETE FROM public.pets;
DELETE FROM public.posts;
DELETE FROM public.otps;
DELETE FROM public.profiles;

-- Delete all users from auth (this will cascade to any remaining related data)
DELETE FROM auth.users;