import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Navigation, Play, CheckCircle, MapPin } from 'lucide-react';

interface JobStatusUpdaterProps {
  jobId: string;
  currentStatus: string;
  jobAddress: string;
  onStatusUpdate: () => void;
}

const JOB_STATUSES = [
  { key: 'scheduled', label: 'Scheduled', icon: Clock, variant: 'secondary' as const },
  { key: 'on_way', label: 'On Way', icon: Navigation, variant: 'outline' as const },
  { key: 'in_progress', label: 'Started', icon: Play, variant: 'default' as const },
  { key: 'completed', label: 'Complete', icon: CheckCircle, variant: 'secondary' as const }
];

export default function JobStatusUpdater({ 
  jobId, 
  currentStatus, 
  jobAddress, 
  onStatusUpdate 
}: JobStatusUpdaterProps) {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const getCurrentStatusIndex = () => {
    console.log('Current status from props:', currentStatus);
    // Handle both the enhanced status and basic status, and normalize case
    const normalizedStatus = currentStatus?.toLowerCase();
    const index = JOB_STATUSES.findIndex(status => 
      status.key === normalizedStatus || 
      status.label.toLowerCase() === normalizedStatus
    );
    console.log('Found status index:', index, 'for status:', normalizedStatus);
    return Math.max(0, index); // Default to 0 if not found
  };

  const updateJobStatus = async (newStatus: string) => {
    setUpdating(true);
    console.log('Updating job status to:', newStatus, 'for job ID:', jobId);
    
    try {
      // Update the engineer_status field specifically for engineer progress
      const { error } = await supabase
        .from('orders')
        .update({ 
          engineer_status: newStatus,
          manual_status_override: true,
          manual_status_notes: `Engineer status: ${JOB_STATUSES.find(s => s.key === newStatus)?.label}`
        })
        .eq('id', jobId);

      if (error) {
        console.error('Database update error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Engineer status updated successfully to:', newStatus);

      // Log the status change activity
      const { error: logError } = await supabase.rpc('log_order_activity', {
        p_order_id: jobId,
        p_activity_type: 'engineer_status_update',
        p_description: `Engineer updated status to ${JOB_STATUSES.find(s => s.key === newStatus)?.label}`,
        p_details: {
          engineer_status: newStatus,
          updated_by_engineer: true
        }
      });

      if (logError) {
        console.error('Activity log error:', logError);
        // Don't throw here as the main update succeeded
      }

      toast({
        title: "Status Updated",
        description: `Job status updated to ${JOB_STATUSES.find(s => s.key === newStatus)?.label}`,
      });

      onStatusUpdate();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update job status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getGoogleMapsUrl = () => {
    const encodedAddress = encodeURIComponent(jobAddress);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  };

  const currentIndex = getCurrentStatusIndex();
  const currentStatusInfo = JOB_STATUSES[currentIndex] || JOB_STATUSES[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <currentStatusInfo.icon className="h-5 w-5" />
          <span>Job Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Current Status:</span>
            <Badge variant={currentStatusInfo.variant} className={
              currentStatus === 'completed' ? 'bg-green-100 text-green-800' : ''
            }>
              <currentStatusInfo.icon className="h-3 w-3 mr-1" />
              {currentStatusInfo.label}
            </Badge>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(getGoogleMapsUrl(), '_blank')}
            className="flex items-center space-x-1"
          >
            <MapPin className="h-3 w-3" />
            <span>Get Directions</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {JOB_STATUSES.map((status, index) => {
            const isCurrentStatus = status.key === currentStatus?.toLowerCase();
            const isPastStatus = index < currentIndex;
            const isNextStatus = index === currentIndex + 1;
            const canClick = !updating && (isNextStatus || (currentIndex === -1 && index === 0));

            return (
              <Button
                key={status.key}
                variant={isCurrentStatus ? "default" : isPastStatus ? "secondary" : "outline"}
                size="sm"
                disabled={!canClick && !isCurrentStatus}
                onClick={() => canClick ? updateJobStatus(status.key) : undefined}
                className={`flex items-center space-x-1 ${
                  isPastStatus ? 'opacity-60' : ''
                } ${
                  canClick ? 'ring-2 ring-primary/50 hover:ring-primary' : ''
                }`}
              >
                <status.icon className="h-3 w-3" />
                <span>{status.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
          Click the next status to update your progress
        </div>
      </CardContent>
    </Card>
  );
}