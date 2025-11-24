import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "./useIsAdmin";

interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export const useMaintenanceMode = () => {
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const fetchMaintenanceMode = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .maybeSingle();

        if (error) throw error;
        
        if (data && typeof data.value === 'object' && data.value !== null) {
          const value = data.value as Record<string, unknown>;
          setMaintenanceMode({
            enabled: Boolean(value.enabled),
            message: String(value.message || ""),
          });
        }
      } catch (error) {
        console.error("Error fetching maintenance mode:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenanceMode();

    const channel = supabase
      .channel("system_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "system_settings",
          filter: "key=eq.maintenance_mode",
        },
        (payload) => {
          const value = payload.new.value as Record<string, unknown>;
          setMaintenanceMode({
            enabled: Boolean(value.enabled),
            message: String(value.message || ""),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const shouldBlockAccess = maintenanceMode?.enabled && !isAdmin;

  return { maintenanceMode, loading, shouldBlockAccess };
};
