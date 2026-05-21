-- Add storage policies for messages bucket
-- Allow insert to messages bucket when folder matches user id
CREATE POLICY "Allow insert to messages by owner folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'messages' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access for messages bucket
CREATE POLICY "Allow select on messages bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'messages');