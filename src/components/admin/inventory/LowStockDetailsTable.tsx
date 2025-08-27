import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, User } from 'lucide-react';
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';

interface LowStockDetailsTableProps {
  className?: string;
}

export const LowStockDetailsTable: React.FC<LowStockDetailsTableProps> = ({ className }) => {
  const { useLowStockEngineerDetails } = useInventoryEnhanced();
  const { data: lowStockDetails, isLoading, error } = useLowStockEngineerDetails();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Engineer Low Stock Details
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

  if (!lowStockDetails || lowStockDetails.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-success" />
            Engineer Stock Status
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'critical_low':
        return <Badge variant="destructive">Critical Low</Badge>;
      case 'low_stock':
        return <Badge variant="secondary">Low Stock</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Engineer Low Stock Details
          <Badge variant="outline" className="ml-auto">
            {lowStockDetails.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Engineer
                  </div>
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Reorder Point</TableHead>
                <TableHead className="text-right">Shortage</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockDetails.map((detail, index) => (
                <TableRow key={`${detail.location_id}-${detail.item_id}`} className="group">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{detail.engineer_name}</span>
                      {detail.engineer_email && (
                        <span className="text-xs text-muted-foreground">{detail.engineer_email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{detail.item_name}</div>
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-xs">{detail.item_sku}</code>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={detail.current_stock === 0 ? 'text-destructive font-semibold' : ''}>
                      {detail.current_stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {detail.reorder_point}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="text-warning font-semibold">
                      -{detail.shortage}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(detail.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};