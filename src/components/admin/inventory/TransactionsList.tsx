import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, AlertCircle, TrendingUp, TrendingDown, Settings, CheckCircle, XCircle, History, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { QuickAdjustModal } from "./QuickAdjustModal";
import { TransactionApprovalModal } from "./TransactionApprovalModal";
import { TransactionAuditModal } from "./TransactionAuditModal";

interface Transaction {
  id: string;
  qty: number;
  direction: string;
  reference: string | null;
  notes: string | null;
  status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTransactionId, setAuditTransactionId] = useState<string | null>(null);

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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleApprovalClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowApprovalModal(true);
  };

  const handleAuditClick = (transactionId: string) => {
    setAuditTransactionId(transactionId);
    setShowAuditModal(true);
  };

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
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.inventory_items.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {transaction.inventory_items.sku}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.inventory_locations.name}</div>
                          {transaction.inventory_locations.code && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {transaction.inventory_locations.code}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={transaction.direction === 'in' ? 'default' : transaction.direction === 'out' ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {transaction.direction === 'in' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : transaction.direction === 'out' ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Settings className="h-3 w-3" />
                          )}
                          {transaction.direction === 'in' ? 'In' : transaction.direction === 'out' ? 'Out' : 'Adjust'} ({Math.abs(transaction.qty)})
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <Badge className={getStatusColor(transaction.status)}>
                            {(transaction.status || 'pending').charAt(0).toUpperCase() + (transaction.status || 'pending').slice(1)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.reference || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(transaction.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprovalClick(transaction)}
                            className="h-6 px-2 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Manage
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAuditClick(transaction.id)}
                            className="h-6 px-2 text-xs"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
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

      <TransactionApprovalModal
        open={showApprovalModal}
        onOpenChange={setShowApprovalModal}
        transaction={selectedTransaction}
      />

      <TransactionAuditModal
        open={showAuditModal}
        onOpenChange={setShowAuditModal}
        transactionId={auditTransactionId}
      />
    </>
  );
}