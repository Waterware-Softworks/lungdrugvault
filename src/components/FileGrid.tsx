import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileIcon, Trash2, Share2, Download, Copy, Check } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "./ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface File {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
  user_id: string;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
}

interface FileGridProps {
  files: File[];
  onFileDeleted: () => void;
}

export const FileGrid = ({ files, onFileDeleted }: FileGridProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const deleteFile = async (file: File) => {
    try {
      setDeletingId(file.id);

      const { error: storageError } = await supabase.storage
        .from('user-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast.success("File deleted successfully");
      onFileDeleted();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  };

  const generateShareLink = async (fileId: string) => {
    try {
      const shareToken = crypto.randomUUID();
      
      const { error } = await supabase
        .from('file_shares')
        .insert({
          file_id: fileId,
          share_token: shareToken,
        });

      if (error) throw error;

      const link = `${window.location.origin}/share/${shareToken}`;
      setShareLink(link);
      toast.success("Share link created!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create share link");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard!");
  };

  const downloadFile = async (file: File) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download file");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <FileIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">No files yet. Upload your first file!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {files.map((file) => (
        <Card
          key={file.id}
          className="group bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-smooth overflow-hidden"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32 mb-4 bg-secondary/50 rounded-xl">
              <FileIcon className="w-16 h-16 text-primary" />
            </div>
            <h3 className="font-semibold truncate mb-1" title={file.name}>
              {file.name}
            </h3>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
              {file.profiles?.username && (
                <p className="text-xs text-muted-foreground">
                  By @{file.profiles.username}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 p-4 pt-0">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 hover:bg-primary/10 hover:text-primary"
              onClick={() => downloadFile(file)}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 hover:bg-primary/10 hover:text-primary"
                  onClick={() => generateShareLink(file.id)}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Share File</DialogTitle>
                  <DialogDescription>
                    Anyone with this link can download the file
                  </DialogDescription>
                </DialogHeader>
                {shareLink && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={copyToClipboard}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 hover:bg-destructive/10 hover:text-destructive"
                  disabled={deletingId === file.id}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete File</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{file.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteFile(file)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
