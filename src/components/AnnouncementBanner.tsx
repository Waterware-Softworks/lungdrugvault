import { useAnnouncement } from "@/hooks/useAnnouncement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";

export const AnnouncementBanner = () => {
  const { announcement, loading } = useAnnouncement();

  if (loading || !announcement?.enabled || !announcement.message) {
    return null;
  }

  const getIcon = () => {
    switch (announcement.type) {
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    return announcement.type === "error" ? "destructive" : "default";
  };

  return (
    <Alert variant={getVariant()} className="rounded-none border-x-0 border-t-0">
      {getIcon()}
      <AlertDescription>{announcement.message}</AlertDescription>
    </Alert>
  );
};
