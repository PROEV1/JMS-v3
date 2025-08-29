import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, User, FileText, CheckCircle, XCircle, Edit, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TransactionAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  reason: string | null;
  performed_at: string;
  performed_by: string | null;
  old_data: any;
  new_data: any;
}

export const TransactionAuditModal: React.FC<TransactionAuditModalProps> = ({
  open,
  onOpenChange,
  transactionId
}) => {
  const { data: auditEntries, isLoading } = useQuery({
    queryKey: ['inventory-audit', transactionId],
    queryFn: async () => {
      if (!transactionId) return [];
      
      const { data, error } = await supabase
        .from('inventory_txn_audit')
        .select(`
          id,
          action,
          reason,
          performed_at,
          old_data,
          new_data,
          performed_by
        `)
        .eq('txn_id', transactionId)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!transactionId && open
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <Plus className="h-4 w-4 text-blue-500" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'modified': return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'deleted': return <Trash2 className="h-4 w-4 text-red-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'modified': return 'bg-yellow-100 text-yellow-800';
      case 'deleted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatActionLabel = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction Audit Trail
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[600px]">
          {isLoading ? (
            <div className="text-center py-8">Loading audit trail...</div>
          ) : !auditEntries?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit entries found for this transaction.
            </div>
          ) : (
            <div className="space-y-4">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4 space-y-3">
                  {/* Action Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getActionIcon(entry.action)}
                      <Badge className={getActionColor(entry.action)}>
                        {formatActionLabel(entry.action)}
                      </Badge>
                      {entry.reason && (
                        <span className="text-sm text-muted-foreground">
                          Reason: {entry.reason}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      {format(new Date(entry.performed_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>

                  {/* Performed By */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>
                      {entry.performed_by || 'System'}
                    </span>
                  </div>

                  {/* Data Changes */}
                  {(entry.old_data || entry.new_data) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {entry.old_data && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Before:</h4>
                          <div className="bg-red-50 p-3 rounded text-xs">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(entry.old_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {entry.new_data && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">After:</h4>
                          <div className="bg-green-50 p-3 rounded text-xs">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(entry.new_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};