-- Add privacy policy acceptance tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS account_deletion_requested_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN public.profiles.privacy_policy_accepted IS 'Tracks if user has accepted privacy policy';
COMMENT ON COLUMN public.profiles.privacy_policy_accepted_at IS 'Timestamp when privacy policy was accepted';
COMMENT ON COLUMN public.profiles.account_deletion_requested_at IS 'Timestamp when user requested account deletion (30 day retention period)';