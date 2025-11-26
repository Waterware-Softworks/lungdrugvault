import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileGrid } from "@/components/FileGrid";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";

const SharedWithMe = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadSharedFiles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadSharedFiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get all shared items for current user
      const { data: sharedItems, error: sharedError } = await supabase
        .from('shared_items')
        .select('*')
        .eq('shared_with_user_id', user.id);

      if (sharedError) throw sharedError;

      // Get file IDs from shared items
      const fileIds = sharedItems
        ?.filter(item => item.item_type === 'file')
        .map(item => item.item_id) || [];

      if (fileIds.length === 0) {
        setFiles([]);
        return;
      }

      // Fetch the actual files
      const { data, error } = await supabase
        .from('files')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .in('id', fileIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error("Error loading shared files:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Shared With Me</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div>
          <h2 className="text-2xl font-bold mb-6">Files Shared With You</h2>
          {loading ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Loading shared files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-16">
              <Share2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No files have been shared with you yet</p>
            </div>
          ) : (
            <FileGrid files={files} onFileDeleted={loadSharedFiles} isSharedView={true} />
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedWithMe;