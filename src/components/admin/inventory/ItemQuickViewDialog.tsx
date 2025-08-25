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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">SKU</p>
                    <p className="font-semibold text-foreground">{item.sku}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Unit Cost</p>
                    <p className="text-lg font-semibold text-green-600">£{item.default_cost}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reorder Point</p>
                    <p className="font-semibold text-orange-600">{item.reorder_point}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Unit</p>
                    <p className="font-semibold text-blue-600">{item.unit}</p>
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
                  <div key={index} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{loc.location}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Available: <span className="font-medium text-green-600">{loc.stock - loc.reserved}</span>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Reserved: <span className="font-medium text-orange-600">{loc.reserved}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{loc.stock}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
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