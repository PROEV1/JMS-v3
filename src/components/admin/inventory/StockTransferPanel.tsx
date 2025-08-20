import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, ArrowRightLeft } from "lucide-react";
import { StockTransferModal } from "./StockTransferModal";

export function StockTransferPanel() {
  const [showTransferModal, setShowTransferModal] = useState(false);

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Stock Transfer
              </CardTitle>
              <Button onClick={() => setShowTransferModal(true)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer Stock
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium mb-2">Transfer Stock Between Locations</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Move inventory items from one location to another to optimize stock distribution.
            </p>
            <Button onClick={() => setShowTransferModal(true)} variant="outline">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Start Transfer
            </Button>
          </CardContent>
        </Card>
      </div>

      <StockTransferModal 
        open={showTransferModal} 
        onOpenChange={setShowTransferModal} 
      />
    </>
  );
}