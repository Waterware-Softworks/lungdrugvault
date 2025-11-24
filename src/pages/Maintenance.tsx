import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Construction } from "lucide-react";

const Maintenance = () => {
  const { maintenanceMode } = useMaintenanceMode();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Under Maintenance</h1>
          <p className="text-muted-foreground">
            {maintenanceMode?.message || "We are currently performing maintenance. Please check back soon."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
