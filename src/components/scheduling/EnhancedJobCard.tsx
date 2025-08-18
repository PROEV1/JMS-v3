
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, User, AlertTriangle, Wrench } from 'lucide-react';
import { Order, getOrderEstimatedHours } from '@/utils/schedulingUtils';
import { SmartAssignmentModal } from './SmartAssignmentModal';
import { SendOfferModal } from './SendOfferModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnhancedJobCardProps {
  order: Order;
  engineers: any[];
  onUpdate?: () => void;
}

export function EnhancedJobCard({ order, engineers, onUpdate }: EnhancedJobCardProps) {
  const [showSmartAssign, setShowSmartAssign] = useState(false);
  const [showSendOffer, setShowSendOffer] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_install_booking':
        return 'destructive';
      case 'scheduled':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleAssignment = async (engineerId: string, date: string, action: 'send_offer' | 'confirm_book') => {
    try {
      if (action === 'send_offer') {
        // Send offer to client
        const { data, error } = await supabase.functions.invoke('send-offer', {
          body: {
            order_id: order.id,
            engineer_id: engineerId,
            offered_date: date,
            time_window: order.time_window,
            delivery_channel: 'email'
          }
        });

        if (error || data?.error) {
          throw new Error(data?.error || 'Failed to send offer');
        }

        // Log activity
        await supabase.rpc('log_order_activity', {
          p_order_id: order.id,
          p_activity_type: 'offer_sent',
          p_description: `Installation offer sent via Smart Assignment`,
          p_details: {
            engineer_id: engineerId,
            offered_date: date,
            time_window: order.time_window,
            method: 'smart_assignment'
          }
        });

      } else if (action === 'confirm_book') {
        // Direct booking - update order
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            engineer_id: engineerId,
            scheduled_install_date: date,
            status_enhanced: 'scheduled'
          })
          .eq('id', order.id);

        if (updateError) {
          throw new Error('Failed to book installation');
        }

        // Log activity
        await supabase.rpc('log_order_activity', {
          p_order_id: order.id,
          p_activity_type: 'installation_booked',
          p_description: `Installation directly booked via Smart Assignment`,
          p_details: {
            engineer_id: engineerId,
            scheduled_date: date,
            time_window: order.time_window,
            method: 'smart_assignment_direct'
          }
        });
      }

        // Refresh the parent component
        if (onUpdate) {
          onUpdate();
        }
        
        // Trigger refresh for status tiles
        window.dispatchEvent(new CustomEvent('scheduling:refresh'));

    } catch (error: any) {
      console.error('Assignment error:', error);
      throw error;
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-medium">
                {order.order_number}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {order.client?.full_name}
              </p>
            </div>
            <Badge variant={getStatusColor(order.status_enhanced)}>
              {order.status_enhanced.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">
                {order.job_address || order.client?.address || 'No address'}
              </span>
            </div>

            {order.scheduled_install_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  {new Date(order.scheduled_install_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {order.engineer_id && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>
                  {engineers.find(e => e.id === order.engineer_id)?.name || 'Unknown Engineer'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{getOrderEstimatedHours(order)}h duration</span>
            </div>

            {order.time_window && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span>{order.time_window}</span>
              </div>
            )}
          </div>

          {order.status_enhanced === 'awaiting_install_booking' && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSmartAssign(true)}
                className="flex-1 text-xs"
              >
                <Wrench className="w-3 h-3 mr-1" />
                Smart Assign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SmartAssignmentModal
        isOpen={showSmartAssign}
        onClose={() => setShowSmartAssign(false)}
        order={order}
        engineers={engineers}
        onAssign={handleAssignment}
      />

      <SendOfferModal
        isOpen={showSendOffer}
        onClose={() => setShowSendOffer(false)}
        order={order}
        engineers={engineers}
        onOfferSent={onUpdate}
      />
    </>
  );
}
