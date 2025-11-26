-- Add foreign key relationship from files to profiles
ALTER TABLE public.files
ADD CONSTRAINT files_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Create folders table
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add folder_id to files table
ALTER TABLE public.files
ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Create shared_items table for sharing files and folders
CREATE TABLE public.shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'folder')),
  item_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(item_type, item_id, shared_with_user_id)
);

-- Enable RLS on folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view own folders"
ON public.folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
ON public.folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
ON public.folders FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on shared_items
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;

-- Shared items policies
CREATE POLICY "Users can view items shared with them"
ON public.shared_items FOR SELECT
USING (auth.uid() = shared_with_user_id OR auth.uid() = shared_by_user_id);

CREATE POLICY "Users can create shares for own items"
ON public.shared_items FOR INSERT
WITH CHECK (auth.uid() = shared_by_user_id);

CREATE POLICY "Users can delete shares they created"
ON public.shared_items FOR DELETE
USING (auth.uid() = shared_by_user_id);

-- Allow users to view shared files
CREATE POLICY "Users can view shared files"
ON public.files FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'file' 
    AND item_id = files.id 
    AND shared_with_user_id = auth.uid()
  )
);

-- Allow users to view shared folders
CREATE POLICY "Users can view shared folders"
ON public.folders FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'folder' 
    AND item_id = folders.id 
    AND shared_with_user_id = auth.uid()
  )
);

-- Create trigger for folders updated_at
CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();