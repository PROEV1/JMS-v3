import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, AlertTriangle, Truck } from "lucide-react";

interface ItemQuickViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
}

export function ItemQuickViewDialog({ open, onOpenChange, item }: ItemQuickViewDialogProps) {
  if (!item) return null;

  const stockLocations = [
    { location: "Main Warehouse", stock: 45, reserved: 5 },
    { location: "Van 1", stock: 3, reserved: 0 },
    { location: "Van 2", stock: 2, reserved: 1 },
  ];

  const recentTransactions = [
    { date: "2024-01-15", type: "In", qty: 10, location: "Main Warehouse", reference: "PO-2024-001" },
    { date: "2024-01-14", type: "Out", qty: -2, location: "Van 1", reference: "Job #12345" },
    { date: "2024-01-13", type: "Transfer", qty: 5, location: "Van 1 → Van 2", reference: "Stock rebalance" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {item.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Item Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">SKU</p>
                    <p className="font-medium">{item.sku}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-medium">£{item.default_cost}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reorder Point</p>
                    <p className="font-medium">{item.reorder_point}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="font-medium">{item.unit}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {item.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Stock by Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stockLocations.map((loc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{loc.location}</p>
                      <p className="text-sm text-muted-foreground">
                        Available: {loc.stock - loc.reserved} • Reserved: {loc.reserved}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{loc.stock}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentTransactions.map((txn, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant={txn.type === 'In' ? 'default' : txn.type === 'Out' ? 'destructive' : 'secondary'}>
                        {txn.type}
                      </Badge>
                      <div>
                        <p className="font-medium">{txn.reference}</p>
                        <p className="text-sm text-muted-foreground">{txn.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${txn.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.qty > 0 ? '+' : ''}{txn.qty}
                      </p>
                      <p className="text-sm text-muted-foreground">{txn.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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