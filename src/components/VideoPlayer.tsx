import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Film, Download } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  fileName: string;
  storagePath?: string;
}

export const VideoPlayer = ({ isOpen, onClose, videoUrl, fileName, storagePath }: VideoPlayerProps) => {
  const downloadVideo = async () => {
    if (!storagePath) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Video downloaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to download video");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-b from-card to-card/95 border-border max-w-6xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="truncate text-lg">{fileName}</DialogTitle>
            </div>
            {storagePath && (
              <Button
                size="sm"
                variant="outline"
                onClick={downloadVideo}
                className="gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="w-full p-6 pt-4">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
            <video 
              controls 
              autoPlay
              className="w-full aspect-video"
              src={videoUrl}
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
