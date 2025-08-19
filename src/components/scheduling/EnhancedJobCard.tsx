import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserPlus, UserMinus, Calendar, ExternalLink, CheckCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Database } from '@/integrations/supabase/types';
import { getOrderEstimatedMinutes, isDefaultEstimatedHours } from '@/utils/schedulingUtils';

type Order = Database['public']['Tables']['orders']['Row'] & {
  clients?: { name: string; email: string; phone: string; };
  quotes?: { products?: any[]; };
  engineer?: { name: string; email: string; region?: string; };
};
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnhancedJobCardProps {
  order: Order;
  onAssignEngineer?: (orderId: string) => void;
  onUnassign?: (orderId: string) => void;
  onSchedule?: (orderId: string) => void;
  onUpdate?: () => void;
}

export function EnhancedJobCard({ order, onAssignEngineer, onUnassign, onSchedule, onUpdate }: EnhancedJobCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: unassignEngineer } = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ engineer_id: null })
        .eq('id', orderId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onUpdate?.();
      toast({ title: 'Engineer unassigned successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error unassigning engineer',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { mutate: confirmInPartner } = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({
          partner_confirmed_externally: true,
          partner_confirmed_at: new Date().toISOString(),
          external_confirmation_source: 'manual_ops'
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onUpdate?.();
      toast({ title: 'Order marked as confirmed in partner system' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error confirming order',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleUnassign = (orderId: string) => {
    unassignEngineer(orderId);
  };

  const handlePartnerConfirm = (orderId: string) => {
    confirmInPartner(orderId);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {order.order_number}
              {order.job_type && (
                <Badge variant="secondary" className="text-xs">
                  {order.job_type.charAt(0).toUpperCase() + order.job_type.slice(1).replace('_', ' ')}
                </Badge>
              )}
              {order.is_partner_job && (
                <Badge variant="outline" className="text-xs">
                  Partner
                </Badge>
              )}
              {order.scheduling_suppressed && (
                <Badge variant="destructive" className="text-xs">
                  Suppressed
                </Badge>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              <p>{order.clients?.name}</p>
              {order.sub_partner && (
                <p className="text-xs">Dealer: {order.sub_partner}</p>
              )}
              {order.postcode && <p>{order.postcode}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {order.partner_external_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(order.partner_external_url!, '_blank')}
                title="Open in Partner JMS"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!order.engineer_id ? (
                  <DropdownMenuItem onClick={() => onAssignEngineer?.(order.id)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Engineer
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => onSchedule?.(order.id)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUnassign(order.id)}>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unassign
                    </DropdownMenuItem>
                  </>
                )}
                {order.is_partner_job && !order.partner_confirmed_externally && (
                  <DropdownMenuItem onClick={() => handlePartnerConfirm(order.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Confirmed in Partner
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {order.engineer_id ? (
            <div className="space-y-1 text-sm text-muted-foreground border-b pb-3">
            <p>
              Engineer: {order.engineer?.name} ({order.engineer?.email})
            </p>
            {order.scheduled_install_date ? (
              <p>
                Scheduled:{' '}
                {new Date(order.scheduled_install_date).toLocaleDateString(
                  'en-GB'
                )}
              </p>
            ) : (
              <p className="text-orange-500">Not Scheduled</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground border-b pb-3">
            <p className="text-orange-500">No engineer assigned</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            Duration:{' '}
            <span className="font-medium text-foreground">
              {getOrderEstimatedMinutes(order)} mins
            </span>
            {isDefaultEstimatedHours(order) && (
              <Badge variant="outline" className="text-xs px-1 py-0" title="Using default duration estimate">
                Default
              </Badge>
            )}
          </div>
          <div>
            {order.created_at && (
              <>
                Created:{' '}
                <span className="font-medium text-foreground">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </span>
              </>
            )}
          </div>
        </div>
        
        {order.partner_status && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <p>Partner Status: {order.partner_status}</p>
            {order.partner_confirmed_externally && (
              <p className="text-green-600">✓ Confirmed in Partner JMS</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
