import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, User, Plus } from 'lucide-react';
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';
import { useNavigate } from 'react-router-dom';

interface EngineerLowStockPanelProps {
  className?: string;
}

export const EngineerLowStockPanel: React.FC<EngineerLowStockPanelProps> = ({ className }) => {
  const { useLowStockEngineerDetails } = useInventoryEnhanced();
  const { data: lowStockDetails, isLoading } = useLowStockEngineerDetails();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Engineer Low Stock Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Type guard and null check
  const stockDetails = Array.isArray(lowStockDetails) ? lowStockDetails : [];

  if (stockDetails.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-success" />
            Engineer Low Stock Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>All engineers have adequate stock levels</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group low stock items by engineer
  const engineerGroups = stockDetails.reduce((acc, detail: any) => {
    const engineerKey = detail.engineer_name || 'Unknown Engineer';
    if (!acc[engineerKey]) {
      acc[engineerKey] = [];
    }
    acc[engineerKey].push(detail);
    return acc;
  }, {} as Record<string, any[]>);

  const handleCreateStockRequest = () => {
    navigate('/admin/inventory?tab=requests');
  };

  const handleViewInventory = () => {
    navigate('/admin/inventory');
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Engineer Low Stock Status
            <Badge variant="destructive" className="ml-2">
              {Object.keys(engineerGroups).length} engineers affected
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleViewInventory}>
              View Inventory
            </Button>
            <Button size="sm" onClick={handleCreateStockRequest}>
              <Plus className="h-4 w-4 mr-2" />
              Create Stock Request
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(engineerGroups).map(([engineerName, items]: [string, any[]]) => (
            <div key={engineerName} className="border rounded-lg p-4 bg-destructive/5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{engineerName}</span>
                <Badge variant="secondary" className="text-xs">
                  {items.length} items low
                </Badge>
              </div>
              
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((detail: any, index: number) => (
                  <div key={`${detail.location_id}-${detail.item_id}-${index}`} 
                       className="bg-background rounded p-3 border">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{detail.item_name}</div>
                        <div className="text-xs text-muted-foreground">{detail.item_sku}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-destructive font-semibold">
                          {detail.current_stock} / {detail.reorder_point}
                        </div>
                        <div className="text-muted-foreground">current / min</div>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      {detail.status === 'out_of_stock' && (
                        <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                      )}
                      {detail.status === 'critical_low' && (
                        <Badge variant="destructive" className="text-xs">Critical Low</Badge>
                      )}
                      {detail.status === 'low_stock' && (
                        <Badge variant="secondary" className="text-xs">Low Stock</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};