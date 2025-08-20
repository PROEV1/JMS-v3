
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { AddLocationModal } from "./AddLocationModal";

interface SimplePlaceholderProps {
  title: string;
  icon: React.ReactNode;
  description: string;
}

export function SimplePlaceholder({ title, icon, description }: SimplePlaceholderProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const isLocations = title === "Locations";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {isLocations && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="text-6xl mb-4">🚧</div>
          <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
          <p className="text-xs text-muted-foreground">
            This feature is under development and will be available soon.
          </p>
        </CardContent>
      </Card>

      {isLocations && (
        <AddLocationModal 
          open={showAddModal} 
          onOpenChange={setShowAddModal} 
        />
      )}
    </>
  );
}
