import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Check, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PartsSectionProps {
  orderId: string;
  partRequired?: boolean;
  partDetails?: string | null;
  partsOrdered?: boolean;
  onUpdate?: () => void;
}

export function PartsSection({ 
  orderId, 
  partRequired, 
  partDetails, 
  partsOrdered,
  onUpdate 
}: PartsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarkPartsOrdered = async () => {
    if (!partRequired || partsOrdered) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          parts_ordered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Parts marked as ordered",
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error marking parts as ordered:', error);
      toast({
        title: "Error",
        description: "Failed to mark parts as ordered",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkPartsDelivered = async () => {
    if (!partRequired || !partsOrdered) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          parts_delivered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Parts marked as delivered",
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error marking parts as delivered:', error);
      toast({
        title: "Error",
        description: "Failed to mark parts as delivered",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!partRequired) {
    return null;
  }

  const getPartsStatus = () => {
    if (partsOrdered) {
      return {
        icon: Check,
        text: "Parts Ordered",
        variant: "default" as const,
        color: "text-green-600"
      };
    }
    return {
      icon: Clock,
      text: "Parts Required",
      variant: "outline" as const,
      color: "text-orange-600"
    };
  };

  const status = getPartsStatus();
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Parts Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parts Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <Badge variant={status.variant} className={status.color}>
              {status.text}
            </Badge>
          </div>
          
          {/* Action Buttons */}
          {!partsOrdered && (
            <Button
              onClick={handleMarkPartsOrdered}
              disabled={isUpdating}
              size="sm"
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              {isUpdating ? 'Updating...' : 'Mark as Ordered'}
            </Button>
          )}
        </div>

        {/* Parts Details */}
        {partDetails && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm">Required Parts</h4>
                <p className="text-blue-800 text-sm mt-1">{partDetails}</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">Parts Workflow:</p>
          <ul className="space-y-1">
            <li>1. Review parts requirements above</li>
            <li>2. Order the required parts from suppliers</li>
            <li>3. Click "Mark as Ordered" when parts have been ordered</li>
            <li>4. Job will move to scheduling once parts are confirmed ordered</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}