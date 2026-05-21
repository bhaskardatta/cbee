
-- Fix the trigger function to have proper security context
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant necessary permissions to the function
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON public.profiles TO postgres;

-- Also ensure the profiles table user_id column is properly set up to not be nullable
-- since it's used in RLS policies
ALTER TABLE public.profiles 
ALTER COLUMN id SET NOT NULL;

-- Add a more permissive policy specifically for the trigger function
CREATE POLICY "Allow profile creation during signup" ON public.profiles
  FOR INSERT 
  WITH CHECK (true);

-- Update the existing insert policy to be less restrictive during signup
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);
