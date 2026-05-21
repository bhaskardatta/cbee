BEGIN;

-- Ensure RLS is enabled on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive UPDATE policy that allowed any user to update any order
DROP POLICY IF EXISTS "Edge functions can update orders" ON public.orders;

-- Recreate strict SELECT policy to allow only the owner to read their orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- Recreate strict INSERT policy to ensure only the owner can create an order tied to their user_id
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

COMMIT;