import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  AlertTriangle,
  CheckCircle,
  Save
} from "lucide-react";

interface Engineer {
  id: string;
  name: string;
  email: string;
  region: string | null;
  availability: boolean;
}

interface EnhancedInstallManagementProps {
  orderId: string;
  currentEngineerId?: string | null;
  currentInstallDate?: string | null;
  timeWindow?: string | null;
  estimatedDuration?: number | null;
  internalNotes?: string | null;
  paymentReceived: boolean;
  agreementSigned: boolean;
  onUpdate: () => void;
}

export function EnhancedInstallManagement({
  orderId,
  currentEngineerId,
  currentInstallDate,
  timeWindow,
  estimatedDuration,
  internalNotes,
  paymentReceived,
  agreementSigned,
  onUpdate
}: EnhancedInstallManagementProps) {
  const { toast } = useToast();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState(currentEngineerId || 'unassigned');
  const [installDate, setInstallDate] = useState(
    currentInstallDate ? new Date(currentInstallDate).toISOString().split('T')[0] : ''
  );
  const [selectedTimeWindow, setSelectedTimeWindow] = useState(timeWindow || '');
  const [duration, setDuration] = useState(estimatedDuration?.toString() || '');
  const [notes, setNotes] = useState(internalNotes || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEngineers();
  }, []);

  const fetchEngineers = async () => {
    try {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) throw error;
      setEngineers(data || []);
    } catch (error) {
      console.error('Error fetching engineers:', error);
    }
  };

  const canBookInstall = paymentReceived && agreementSigned;

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updates: any = {
        time_window: selectedTimeWindow || null,
        estimated_duration_hours: duration ? parseInt(duration) : null,
        internal_install_notes: notes || null,
      };

      // Check if engineer or date is changing - reset engineer sign-off if so
      const engineerChanging = selectedEngineerId !== (currentEngineerId || 'unassigned');
      const dateChanging = installDate !== (currentInstallDate ? new Date(currentInstallDate).toISOString().split('T')[0] : '');
      
      let needsArchival = false;
      let resetReason = '';

      // Check if we need to archive (there's existing engineer work to preserve)
      if ((engineerChanging || dateChanging) && currentEngineerId && currentInstallDate) {
        needsArchival = true;
        resetReason = engineerChanging ? 'engineer_changed' : 'rescheduled';
      }

      // Archive engineer work if needed (before clearing)
      if (needsArchival) {
        const { error: archiveError } = await supabase.rpc('archive_engineer_work', {
          p_order_id: orderId,
          p_reset_reason: resetReason,
          p_scheduled_date_after: installDate || null
        });
        
        if (archiveError) {
          console.error('Archive error:', archiveError);
        }
      }
      
      if (engineerChanging || dateChanging) {
        updates.engineer_signed_off_at = null;
        updates.engineer_signature_data = null;
        updates.engineer_status = null;
        updates.engineer_notes = null;
      }

      // Reset completion checklist if engineer work is being reset
      if (needsArchival) {
        const { error: checklistError } = await supabase
          .from('order_completion_checklist')
          .update({ 
            is_completed: false, 
            completed_at: null 
          })
          .eq('order_id', orderId);
          
        if (checklistError) {
          console.error('Checklist reset error:', checklistError);
        }
      }

      if (selectedEngineerId && selectedEngineerId !== 'unassigned') {
        updates.engineer_id = selectedEngineerId;
      } else if (selectedEngineerId === 'unassigned') {
        updates.engineer_id = null;
      }

      if (installDate) {
        updates.scheduled_install_date = new Date(installDate).toISOString();
      } else {
        updates.scheduled_install_date = null;
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced activity logging
      if (updates.engineer_signed_off_at === null) {
        const description = needsArchival 
          ? `${resetReason === 'engineer_changed' ? 'Engineer reassigned' : 'Installation rescheduled'} - Previous work archived and engineer workspace reset`
          : 'Engineer status reset due to rescheduling';
          
        try {
          await supabase.rpc('log_order_activity', {
            p_order_id: orderId,
            p_activity_type: 'engineer_status_reset',
            p_description: description,
            p_details: {
              reason: engineerChanging ? 'engineer_changed' : 'date_changed',
              previous_engineer: currentEngineerId,
              new_engineer: selectedEngineerId === 'unassigned' ? null : selectedEngineerId,
              previous_date: currentInstallDate,
              new_date: installDate,
              engineer_work_archived: needsArchival,
              checklist_reset: needsArchival,
              notes_cleared: needsArchival
            }
          });
        } catch (logError) {
          console.error('Failed to log engineer status reset:', logError);
        }
      }

      toast({
        title: "Installation Details Updated",
        description: "All changes have been saved successfully.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating installation details:', error);
      toast({
        title: "Error",
        description: "Failed to update installation details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);

  const hasChanges = 
    selectedEngineerId !== (currentEngineerId || 'unassigned') ||
    installDate !== (currentInstallDate ? new Date(currentInstallDate).toISOString().split('T')[0] : '') ||
    selectedTimeWindow !== (timeWindow || '') ||
    duration !== (estimatedDuration?.toString() || '') ||
    notes !== (internalNotes || '');

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Installation Management</h3>
            <p className="text-muted-foreground text-sm">
              Assign engineer and schedule installation
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={paymentReceived ? "default" : "secondary"}>
              {paymentReceived ? "Payment ✓" : "Payment Pending"}
            </Badge>
            <Badge variant={agreementSigned ? "default" : "secondary"}>
              {agreementSigned ? "Agreement ✓" : "Agreement Pending"}
            </Badge>
          </div>
        </div>

        {!canBookInstall && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Cannot schedule installation until payment is received and agreement is signed.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Engineer Assignment */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="engineer-select">Assign Engineer</Label>
              <Select 
                value={selectedEngineerId} 
                onValueChange={setSelectedEngineerId}
                disabled={!canBookInstall}
              >
                <SelectTrigger>
                  <SelectValue>
                    {selectedEngineerId === 'unassigned' ? (
                      <span className="text-muted-foreground">No engineer assigned</span>
                    ) : (
                      selectedEngineer?.name || "Select engineer"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      No engineer assigned
                    </div>
                  </SelectItem>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{engineer.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {engineer.region && `${engineer.region} • `}{engineer.email}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEngineer && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Engineer Selected</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {selectedEngineer.name}</p>
                  <p><strong>Email:</strong> {selectedEngineer.email}</p>
                  {selectedEngineer.region && (
                    <p><strong>Region:</strong> {selectedEngineer.region}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Installation Date & Time */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="install-date">Installation Date</Label>
              <Input
                id="install-date"
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                disabled={!canBookInstall}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-window">Time Window</Label>
              <Select 
                value={selectedTimeWindow} 
                onValueChange={setSelectedTimeWindow}
                disabled={!canBookInstall}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Morning (8:00 AM - 12:00 PM)
                    </div>
                  </SelectItem>
                  <SelectItem value="afternoon">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Afternoon (12:00 PM - 5:00 PM)
                    </div>
                  </SelectItem>
                  <SelectItem value="all_day">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      All Day (8:00 AM - 5:00 PM)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Estimated Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="8"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 3"
                disabled={!canBookInstall}
              />
            </div>
          </div>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <Label htmlFor="internal-notes">Internal Installation Notes</Label>
          <Textarea
            id="internal-notes"
            placeholder="Access details, parking info, special requirements..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            These notes are only visible to admin and engineers
          </p>
        </div>

        {/* Current Booking Summary */}
        {(installDate || selectedEngineerId !== 'unassigned' || selectedTimeWindow) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Current Booking Details</h4>
            <div className="space-y-1 text-sm text-blue-800">
              {installDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Date: {format(new Date(installDate), 'PPP')}</span>
                </div>
              )}
              {selectedTimeWindow && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Time: {selectedTimeWindow.replace('_', ' ')}</span>
                </div>
              )}
              {selectedEngineer && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Engineer: {selectedEngineer.name}</span>
                </div>
              )}
              {duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {duration} hours</span>
                </div>
              )}
            </div>
          </div>
        )}

        {hasChanges && (
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Installation Details"}
          </Button>
        )}
      </div>
    </Card>
  );
}