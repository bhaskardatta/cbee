-- Update profile creation policy to be more restrictive
DROP POLICY IF EXISTS "Enable profile creation" ON public.profiles;

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add phone column to orders table with proper protection
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS phone text;

-- Drop existing service policy if it exists
DROP POLICY IF EXISTS "Service can update order status" ON public.orders;

-- Create service role policy for updating orders
CREATE POLICY "Service can update order status"
ON public.orders
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);