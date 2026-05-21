-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service can update order status" ON public.orders;

-- Create a secure function to update only the order status
-- This prevents any possibility of modifying sensitive PII fields
CREATE OR REPLACE FUNCTION public.update_order_status(
  order_id uuid,
  new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow updating status field, nothing else
  UPDATE public.orders
  SET 
    status = new_status,
    updated_at = now()
  WHERE id = order_id;
END;
$$;

-- Grant execute permission to service_role only
GRANT EXECUTE ON FUNCTION public.update_order_status TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_order_status FROM authenticated, anon;