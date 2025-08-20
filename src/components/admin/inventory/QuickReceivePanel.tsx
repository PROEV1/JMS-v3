import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, PackageCheck } from "lucide-react";
import { QuickReceiveModal } from "./QuickReceiveModal";

export function QuickReceivePanel() {
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Quick Receive
              </CardTitle>
              <Button onClick={() => setShowReceiveModal(true)}>
                <PackageCheck className="h-4 w-4 mr-2" />
                Receive Stock
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="text-6xl mb-4">📥</div>
            <h3 className="text-lg font-medium mb-2">Receive Incoming Stock</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Quickly record stock receipts from suppliers or returns to update inventory levels.
            </p>
            <Button onClick={() => setShowReceiveModal(true)} variant="outline">
              <PackageCheck className="h-4 w-4 mr-2" />
              Receive Items
            </Button>
          </CardContent>
        </Card>
      </div>

      <QuickReceiveModal 
        open={showReceiveModal} 
        onOpenChange={setShowReceiveModal} 
      />
    </>
  );
}