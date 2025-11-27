import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Download } from "lucide-react";
import { Button } from "./ui/button";

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id: string;
    name: string;
    mime_type: string;
    storage_path: string;
    size: number;
  } | null;
}

export const FilePreview = ({ isOpen, onClose, file }: FilePreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [textContent, setTextContent] = useState<string>("");

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    } else {
      setPreviewUrl("");
      setTextContent("");
    }
  }, [isOpen, file]);

  const loadPreview = async () => {
    if (!file) return;

    try {
      setLoading(true);

      // Handle images
      if (file.mime_type.startsWith('image/')) {
        const { data, error } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 3600);

        if (error) throw error;
        setPreviewUrl(data.signedUrl);
      } 
      // Handle text files
      else if (
        file.mime_type.startsWith('text/') || 
        file.mime_type === 'application/json' ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')
      ) {
        const { data, error } = await supabase.storage
          .from('user-files')
          .download(file.storage_path);

        if (error) throw error;
        const text = await data.text();
        setTextContent(text);
      }
      // Handle PDFs
      else if (file.mime_type === 'application/pdf') {
        const { data, error } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 3600);

        if (error) throw error;
        setPreviewUrl(data.signedUrl);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!file) return;
    
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

  const isImage = file?.mime_type.startsWith('image/');
  const isPDF = file?.mime_type === 'application/pdf';
  const isText = file?.mime_type.startsWith('text/') || 
                 file?.mime_type === 'application/json' ||
                 file?.name.endsWith('.md') ||
                 file?.name.endsWith('.txt');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate max-w-md">{file?.name}</DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadFile}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {isImage && previewUrl && (
                <div className="flex items-center justify-center bg-secondary/20 rounded-lg p-4">
                  <img 
                    src={previewUrl} 
                    alt={file.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              )}
              
              {isPDF && previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] rounded-lg border border-border"
                  title={file.name}
                />
              )}
              
              {isText && textContent && (
                <div className="bg-secondary/20 rounded-lg p-6">
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words max-h-[70vh] overflow-auto">
                    {textContent}
                  </pre>
                </div>
              )}
              
              {!isImage && !isPDF && !isText && (
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <FileText className="w-16 h-16 text-muted-foreground" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <Button onClick={downloadFile} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download to view
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
