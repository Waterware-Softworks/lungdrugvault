import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { FolderPlus } from "lucide-react";

interface CreateFolderDialogProps {
  onFolderCreated: () => void;
}

export const CreateFolderDialog = ({ onFolderCreated }: CreateFolderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    try {
      setCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('folders')
        .insert({
          name: folderName,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success("Folder created successfully!");
      setOpen(false);
      setFolderName("");
      onFolderCreated();
    } catch (error: any) {
      toast.error(error.message || "Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FolderPlus className="w-4 h-4" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for your new folder
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            className="bg-secondary/50"
          />
          <Button
            onClick={handleCreateFolder}
            disabled={creating}
            className="w-full"
          >
            {creating ? "Creating..." : "Create Folder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};