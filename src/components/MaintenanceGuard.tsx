import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldBlockAccess, loading } = useMaintenanceMode();

  useEffect(() => {
    if (!loading && shouldBlockAccess && location.pathname !== "/maintenance") {
      navigate("/maintenance");
    }
  }, [shouldBlockAccess, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
};
