-- Fix: Restrict follows table SELECT access to authenticated users only
-- This prevents public scraping of social network relationships

DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;

CREATE POLICY "Authenticated users can view follows"
ON public.follows
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);