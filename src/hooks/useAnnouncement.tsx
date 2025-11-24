import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AnnouncementSettings {
  enabled: boolean;
  message: string;
  type: "info" | "warning" | "error";
}

export const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState<AnnouncementSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "announcement")
          .maybeSingle();

        if (error) throw error;
        
        if (data && typeof data.value === 'object' && data.value !== null) {
          const value = data.value as Record<string, unknown>;
          setAnnouncement({
            enabled: Boolean(value.enabled),
            message: String(value.message || ""),
            type: (value.type as "info" | "warning" | "error") || "info",
          });
        }
      } catch (error) {
        console.error("Error fetching announcement:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncement();

    const channel = supabase
      .channel("announcement_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "system_settings",
          filter: "key=eq.announcement",
        },
        (payload) => {
          const value = payload.new.value as Record<string, unknown>;
          setAnnouncement({
            enabled: Boolean(value.enabled),
            message: String(value.message || ""),
            type: (value.type as "info" | "warning" | "error") || "info",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { announcement, loading };
};
