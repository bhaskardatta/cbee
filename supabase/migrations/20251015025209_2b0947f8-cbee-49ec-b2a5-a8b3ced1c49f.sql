-- Ensure messages storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure the bucket is public for public URLs
UPDATE storage.buckets SET public = true WHERE id = 'messages';