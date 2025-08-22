import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";

interface LocationStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: { id: string; name: string; type: string };
}

export function LocationStockModal({ open, onOpenChange, location }: LocationStockModalProps) {
  if (!location) return null;

  // Mock stock data for the location
  const stockItems = [
    { id: "1", name: "EV Charger Model A", sku: "EVC-001", quantity: 25, reserved: 2, reorderPoint: 10, unit: "each" },
    { id: "2", name: "Charging Cable 7kW", sku: "CC-7KW", quantity: 15, reserved: 1, reorderPoint: 5, unit: "each" },
    { id: "3", name: "Wall Mount Bracket", sku: "WMB-001", quantity: 8, reserved: 0, reorderPoint: 10, unit: "each" },
    { id: "4", name: "Installation Kit", sku: "IK-STD", quantity: 3, reserved: 1, reorderPoint: 5, unit: "kit" },
  ];

  const totalValue = stockItems.reduce((sum, item) => sum + (item.quantity * 150), 0); // Mock pricing
  const lowStockItems = stockItems.filter(item => item.quantity <= item.reorderPoint);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock at {location.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{stockItems.length}</p>
                <p className="text-sm text-muted-foreground">Items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">£{totalValue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{lowStockItems.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <p className="font-medium text-orange-800">Low Stock Alert</p>
                </div>
                <p className="text-sm text-orange-700">
                  {lowStockItems.length} item(s) are at or below their reorder point
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stock Items List */}
          <div className="space-y-3">
            <h3 className="font-medium">Inventory Items</h3>
            {stockItems.map((item) => (
              <Card key={item.id} className={item.quantity <= item.reorderPoint ? "border-orange-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {item.quantity <= item.reorderPoint && (
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            Low Stock
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Available: {item.quantity - item.reserved}</span>
                        {item.reserved > 0 && <span>Reserved: {item.reserved}</span>}
                        <span>Reorder at: {item.reorderPoint}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{item.quantity}</p>
                      <p className="text-sm text-muted-foreground">{item.unit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}