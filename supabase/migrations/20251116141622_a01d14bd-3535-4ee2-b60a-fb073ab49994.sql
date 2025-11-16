-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-files', 'user-files', false, 52428800, NULL);

-- Create files table to store file metadata
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create file_shares table for shareable links
CREATE TABLE public.file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Enable RLS on files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Users can only see their own files
CREATE POLICY "Users can view own files"
ON public.files FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own files
CREATE POLICY "Users can insert own files"
ON public.files FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON public.files FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on file_shares table
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;

-- Users can view shares for their own files
CREATE POLICY "Users can view shares for own files"
ON public.file_shares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files
    WHERE files.id = file_shares.file_id
    AND files.user_id = auth.uid()
  )
);

-- Users can create shares for their own files
CREATE POLICY "Users can create shares for own files"
ON public.file_shares FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.files
    WHERE files.id = file_shares.file_id
    AND files.user_id = auth.uid()
  )
);

-- Public can view file shares (for downloading via share link)
CREATE POLICY "Public can view file shares by token"
ON public.file_shares FOR SELECT
USING (true);

-- Storage policies for user files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public can download files via share link (handled in edge function)
CREATE POLICY "Public can download shared files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for files table
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();