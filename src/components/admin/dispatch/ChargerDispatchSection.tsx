import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Truck, AlertTriangle, Eye, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { MarkAsDispatchedModal } from './MarkAsDispatchedModal';
import { FlagIssueModal } from './FlagIssueModal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ChargerDispatchSectionProps {
  orderId: string;
}

export function ChargerDispatchSection({ orderId }: ChargerDispatchSectionProps) {
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);

  const { data: dispatchInfo, isLoading } = useQuery({
    queryKey: ['charger-dispatch', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charger_dispatches')
        .select('*, dispatched_by')
        .eq('order_id', orderId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  // Fetch user profile for dispatched_by if available
  const { data: dispatchedByProfile } = useQuery({
    queryKey: ['profile', dispatchInfo?.dispatched_by],
    queryFn: async () => {
      if (!dispatchInfo?.dispatched_by) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', dispatchInfo.dispatched_by)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!dispatchInfo?.dispatched_by
  });

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return <Badge variant="outline">Not Dispatched</Badge>;
    }

    switch (status) {
      case 'pending_dispatch':
        return <Badge variant="outline">Pending Dispatch</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-blue-500">Delivered</Badge>;
      case 'issue':
        return <Badge variant="destructive">Issue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return <Truck className="h-4 w-4 text-green-500" />;
      case 'issue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Charger Dispatch Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(dispatchInfo?.status)}
              <CardTitle>Charger Dispatch Status</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(dispatchInfo?.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/admin/dispatch', '_blank')}
              >
                <Eye className="mr-2 h-4 w-4" />
                View in Dispatch Manager
              </Button>
            </div>
          </div>
          <CardDescription>
            Track charger dispatch and delivery for this installation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!dispatchInfo ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-muted-foreground">
                No charger dispatch recorded for this order
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  onClick={() => setShowDispatchModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Mark as Dispatched
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowIssueModal(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Flag Issue
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  {getStatusBadge(dispatchInfo.status)}
                </div>
              </div>

              {dispatchInfo.dispatched_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dispatched Date</label>
                  <div className="mt-1 text-sm">
                    {format(new Date(dispatchInfo.dispatched_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              )}

              {dispatchedByProfile?.full_name && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dispatched By</label>
                  <div className="mt-1 text-sm">
                    {dispatchedByProfile.full_name}
                  </div>
                </div>
              )}

              {dispatchInfo.tracking_number && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tracking Number</label>
                  <div className="mt-1 text-sm font-mono">
                    {dispatchInfo.tracking_number}
                  </div>
                </div>
              )}

              {dispatchInfo.delivered_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivered Date</label>
                  <div className="mt-1 text-sm">
                    {format(new Date(dispatchInfo.delivered_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              )}

              {dispatchInfo.notes && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <div className="mt-1 text-sm whitespace-pre-wrap">
                    {dispatchInfo.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <MarkAsDispatchedModal
        isOpen={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
        orderId={orderId}
      />

      <FlagIssueModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        orderId={orderId}
      />
    </>
  );
}