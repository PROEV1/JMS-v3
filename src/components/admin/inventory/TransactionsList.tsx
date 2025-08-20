import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, AlertCircle, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { format } from "date-fns";
import { QuickAdjustModal } from "./QuickAdjustModal";

interface Transaction {
  id: string;
  qty: number;
  direction: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  inventory_items: {
    name: string;
    sku: string;
  };
  inventory_locations: {
    name: string;
    code: string | null;
  };
}

export function TransactionsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["inventory-transactions", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('inventory_txns')
        .select(`
          *,
          inventory_items (name, sku),
          inventory_locations (name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`reference.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading transactions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Stock Adjustment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground flex-1">
                Quickly adjust stock levels for items across locations
              </p>
              <Button onClick={() => setShowQuickAdjust(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Stock Adjustment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Transactions ({transactions?.length || 0})
              </CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!transactions || transactions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No transactions found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? 'No transactions match your search criteria.' : 'Stock movements will appear here as they occur.'}
                </p>
                <Button onClick={() => setShowQuickAdjust(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Stock Adjustment
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-sm">
                        {format(new Date(txn.created_at), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{txn.inventory_items.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {txn.inventory_items.sku}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{txn.inventory_locations.name}</div>
                          {txn.inventory_locations.code && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {txn.inventory_locations.code}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={txn.direction === 'in' ? 'default' : txn.direction === 'out' ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {txn.direction === 'in' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : txn.direction === 'out' ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Settings className="h-3 w-3" />
                          )}
                          {txn.direction === 'in' ? 'Stock In' : txn.direction === 'out' ? 'Stock Out' : 'Adjustment'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        <span className={txn.direction === 'out' ? 'text-red-600' : 'text-green-600'}>
                          {txn.direction === 'out' ? '-' : '+'}{Math.abs(txn.qty)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{txn.reference || "N/A"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{txn.notes || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickAdjustModal 
        open={showQuickAdjust} 
        onOpenChange={setShowQuickAdjust} 
      />
    </>
  );
}