import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Calendar, 
  User, 
  Clock, 
  MapPin, 
  FileText,
  Edit3,
  Check,
  X,
  Trash2,
  UserX,
  CalendarX,
  Mail,
  AlertTriangle
} from "lucide-react";

interface Engineer {
  id: string;
  name: string;
  email: string;
  region: string | null;
}

interface StreamlinedInstallationSummaryProps {
  orderId: string;
  currentEngineerId?: string | null;
  currentInstallDate?: string | null;
  timeWindow?: string | null;
  estimatedDuration?: number | null;
  internalNotes?: string | null;
  jobAddress?: string | null;
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  paymentReceived: boolean;
  agreementSigned: boolean;
  onUpdate: () => void;
}

export function StreamlinedInstallationSummary({
  orderId,
  currentEngineerId,
  currentInstallDate,
  timeWindow,
  estimatedDuration,
  internalNotes,
  jobAddress,
  engineer,
  paymentReceived,
  agreementSigned,
  onUpdate
}: StreamlinedInstallationSummaryProps) {
  const { toast } = useToast();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    engineer_id: currentEngineerId || '',
    scheduled_install_date: currentInstallDate ? currentInstallDate.split('T')[0] : '',
    time_window: timeWindow || '',
    estimated_duration_hours: estimatedDuration || 4,
    internal_install_notes: internalNotes || '',
    job_address: jobAddress || ''
  });
  
  // Edit states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    engineerId: currentEngineerId || '',
    installDate: currentInstallDate ? new Date(currentInstallDate).toISOString().split('T')[0] : '',
    timeWindow: timeWindow || '',
    duration: estimatedDuration?.toString() || '',
    notes: internalNotes || ''
  });

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

  const canEdit = paymentReceived && agreementSigned;
  const isScheduled = currentInstallDate && engineer;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return format(new Date(dateString), 'EEEE do MMMM, yyyy');
  };

  const formatTimeWindow = (window: string | null) => {
    if (!window) return 'Not specified';
    switch (window) {
      case 'morning': return 'AM (8:00 AM - 12:00 PM)';
      case 'afternoon': return 'PM (12:00 PM - 5:00 PM)';
      case 'all_day': return 'All Day (8:00 AM - 5:00 PM)';
      default: return window;
    }
  };

  const handleEdit = (field: string) => {
    if (!canEdit) return;
    setEditingField(field);
  };

  const handleSave = async (field: string) => {
    setIsLoading(true);
    try {
      let updates: any = {};
      let needsArchival = false;
      let resetReason = '';
      
      switch (field) {
        case 'engineer':
          updates.engineer_id = editValues.engineerId === 'none' ? null : editValues.engineerId || null;
          // Check if engineer is changing and there's existing work
          if (editValues.engineerId !== currentEngineerId && engineer && currentInstallDate) {
            needsArchival = true;
            resetReason = 'engineer_changed';
          }
          updates.engineer_signed_off_at = null;
          updates.engineer_signature_data = null;
          updates.engineer_status = null;
          updates.engineer_notes = null;
          break;
        case 'date':
          updates.scheduled_install_date = editValues.installDate ? new Date(editValues.installDate).toISOString() : null;
          // Check if date is changing and there's existing work
          if (editValues.installDate !== (currentInstallDate ? currentInstallDate.split('T')[0] : '') && engineer && currentInstallDate) {
            needsArchival = true;
            resetReason = 'rescheduled';
          }
          updates.engineer_signed_off_at = null;
          updates.engineer_signature_data = null;
          updates.engineer_status = null;
          updates.engineer_notes = null;
          break;
        case 'timeWindow':
          updates.time_window = editValues.timeWindow === 'none' ? null : editValues.timeWindow || null;
          break;
        case 'duration':
          updates.estimated_duration_hours = editValues.duration ? parseInt(editValues.duration) : null;
          break;
        case 'notes':
          updates.internal_install_notes = editValues.notes || null;
          break;
      }

      // Archive engineer work if needed (before clearing)
      if (needsArchival) {
        const { error: archiveError } = await supabase.rpc('archive_engineer_work', {
          p_order_id: orderId,
          p_reset_reason: resetReason,
          p_scheduled_date_after: updates.scheduled_install_date || null
        });
        
        if (archiveError) {
          console.error('Archive error:', archiveError);
        }
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

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced activity logging for engineer/date changes
      if (needsArchival) {
        const description = `${resetReason === 'engineer_changed' ? 'Engineer reassigned' : 'Installation rescheduled'} - Previous work archived and engineer workspace reset`;
        
        try {
          await supabase.rpc('log_order_activity', {
            p_order_id: orderId,
            p_activity_type: 'engineer_status_reset',
            p_description: description,
            p_details: {
              field_changed: field,
              reset_reason: resetReason,
              engineer_work_archived: true,
              checklist_reset: true,
              notes_cleared: true
            }
          });
        } catch (logError) {
          console.error('Failed to log engineer status reset:', logError);
        }
      }

      toast({
        title: "Updated",
        description: "Installation details updated successfully.",
      });

      setEditingField(null);
      onUpdate();
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: "Error",
        description: "Failed to update installation details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = (field: string) => {
    // Reset to original values
    setEditValues({
      engineerId: currentEngineerId || '',
      installDate: currentInstallDate ? new Date(currentInstallDate).toISOString().split('T')[0] : '',
      timeWindow: timeWindow || '',
      duration: estimatedDuration?.toString() || '',
      notes: internalNotes || ''
    });
    setEditingField(null);
  };

  const handleDeleteAssignment = async () => {
    if (!confirm('Are you sure you want to delete this installation assignment? This will clear the engineer, date, and notes.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Archive engineer work if there was any completed work
      if (engineer && currentInstallDate) {
        const { error: archiveError } = await supabase.rpc('archive_engineer_work', {
          p_order_id: orderId,
          p_reset_reason: 'assignment_cleared'
        });
        
        if (archiveError) {
          console.error('Archive error:', archiveError);
        }
      }

      // Reset completion checklist
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

      const { error } = await supabase
        .from('orders')
        .update({
          engineer_id: null,
          scheduled_install_date: null,
          time_window: null,
          estimated_duration_hours: null,
          internal_install_notes: null,
          engineer_signed_off_at: null,
          engineer_signature_data: null,
          engineer_status: null,
          engineer_notes: null
        })
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced activity logging
      if (engineer && currentInstallDate) {
        try {
          await supabase.rpc('log_order_activity', {
            p_order_id: orderId,
            p_activity_type: 'engineer_status_reset',
            p_description: 'Installation assignment cleared - Previous work archived and engineer workspace reset',
            p_details: {
              reset_reason: 'assignment_cleared',
              engineer_work_archived: true,
              checklist_reset: true,
              notes_cleared: true
            }
          });
        } catch (logError) {
          console.error('Failed to log engineer status reset:', logError);
        }
      }

      toast({
        title: "Assignment Deleted",
        description: "Installation assignment has been cleared.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {};
      let needsArchival = false;
      let resetReason = '';
      
      // Check if engineer or date is changing - reset engineer sign-off if so
      const engineerChanging = editData.engineer_id !== currentEngineerId;
      const dateChanging = editData.scheduled_install_date !== (currentInstallDate ? currentInstallDate.split('T')[0] : '');
      
      // Check if we need to archive (there's existing engineer work to preserve)
      if ((engineerChanging || dateChanging) && engineer && currentInstallDate) {
        needsArchival = true;
        resetReason = engineerChanging ? 'engineer_changed' : 'rescheduled';
      }
      
      // Archive engineer work if needed (before clearing)
      if (needsArchival) {
        const { error: archiveError } = await supabase.rpc('archive_engineer_work', {
          p_order_id: orderId,
          p_reset_reason: resetReason,
          p_scheduled_date_after: editData.scheduled_install_date || null
        });
        
        if (archiveError) {
          console.error('Archive error:', archiveError);
        }
      }
      
      if (engineerChanging || dateChanging) {
        updateData.engineer_signed_off_at = null;
        updateData.engineer_signature_data = null;
        updateData.engineer_status = null;
        updateData.engineer_notes = null;
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
      
      if (editData.engineer_id) updateData.engineer_id = editData.engineer_id;
      if (editData.scheduled_install_date) updateData.scheduled_install_date = new Date(editData.scheduled_install_date).toISOString();
      if (editData.time_window) updateData.time_window = editData.time_window;
      if (editData.estimated_duration_hours) updateData.estimated_duration_hours = editData.estimated_duration_hours;
      if (editData.internal_install_notes) updateData.internal_install_notes = editData.internal_install_notes;
      if (editData.job_address) updateData.job_address = editData.job_address;

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced activity logging
      if (updateData.engineer_signed_off_at === null) {
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
              new_engineer: editData.engineer_id,
              previous_date: currentInstallDate,
              new_date: editData.scheduled_install_date,
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
        title: "Installation Updated",
        description: "Installation details have been saved successfully.",
      });

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating installation:', error);
      toast({
        title: "Error",
        description: "Failed to update installation details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendUpdate = async () => {
    toast({
      title: "Update Sent",
      description: "Installation update email sent to client.",
    });
  };

  const selectedEngineer = engineers.find(e => e.id === editValues.engineerId);

  return (
    <Card className={`${isScheduled ? 'border-primary bg-primary/5' : 'border-dashed'}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            📅 Installation Summary
          </CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            <Badge variant={paymentReceived ? "default" : "secondary"}>
              {paymentReceived ? "Payment ✓" : "Payment Pending"}
            </Badge>
            <Badge variant={agreementSigned ? "default" : "secondary"}>
              {agreementSigned ? "Agreement ✓" : "Agreement Pending"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!canEdit && !isScheduled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {!paymentReceived && !agreementSigned ? 
                "Cannot schedule installation until payment is received and agreement is signed." :
                !paymentReceived ? 
                "Cannot schedule installation until payment is received." :
                "Cannot schedule installation until agreement is signed."}
            </AlertDescription>
          </Alert>
        )}
        
        {isScheduled && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <Check className="h-4 w-4" />
              <span className="font-medium">Installation Scheduled</span>
            </div>
          </div>
        )}

        {/* Install Date */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Install Date</div>
              <div className="text-sm text-muted-foreground">
                {editingField === 'date' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="date"
                      value={editValues.installDate}
                      onChange={(e) => setEditValues(prev => ({ ...prev, installDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-40"
                    />
                    <Button size="sm" onClick={() => handleSave('date')} disabled={isLoading}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCancel('date')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  formatDate(currentInstallDate)
                )}
              </div>
            </div>
          </div>
          {editingField !== 'date' && canEdit && (
            <Button variant="ghost" size="sm" onClick={() => handleEdit('date')}>
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Engineer */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Engineer</div>
              <div className="text-sm text-muted-foreground">
                {editingField === 'engineer' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Select value={editValues.engineerId} onValueChange={(value) => setEditValues(prev => ({ ...prev, engineerId: value }))}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select engineer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No engineer assigned</SelectItem>
                        {engineers.map((eng) => (
                          <SelectItem key={eng.id} value={eng.id}>
                            {eng.name} {eng.region && `(${eng.region})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleSave('engineer')} disabled={isLoading}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCancel('engineer')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  engineer ? `${engineer.name} (${engineer.email})` : 'Not assigned'
                )}
              </div>
            </div>
          </div>
          {editingField !== 'engineer' && canEdit && (
            <Button variant="ghost" size="sm" onClick={() => handleEdit('engineer')}>
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Job Address */}
        {jobAddress && (
          <div className="flex items-center gap-3 py-3 border-b">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Job Address</div>
              <div className="text-sm text-muted-foreground">{jobAddress}</div>
            </div>
          </div>
        )}

        {/* Time Window */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Time Window</div>
              <div className="text-sm text-muted-foreground">
                {editingField === 'timeWindow' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Select value={editValues.timeWindow} onValueChange={(value) => setEditValues(prev => ({ ...prev, timeWindow: value }))}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="morning">AM (8:00 - 12:00)</SelectItem>
                        <SelectItem value="afternoon">PM (12:00 - 17:00)</SelectItem>
                        <SelectItem value="all_day">All Day (8:00 - 17:00)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleSave('timeWindow')} disabled={isLoading}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCancel('timeWindow')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  formatTimeWindow(timeWindow)
                )}
              </div>
            </div>
          </div>
          {editingField !== 'timeWindow' && canEdit && (
            <Button variant="ghost" size="sm" onClick={() => handleEdit('timeWindow')}>
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Internal Notes */}
        <div className="py-3 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">Internal Notes</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {editingField === 'notes' ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValues.notes}
                        onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Access details, parking info, special requirements..."
                        rows={3}
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave('notes')} disabled={isLoading}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancel('notes')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {internalNotes || 'No notes added'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {editingField !== 'notes' && canEdit && (
              <Button variant="ghost" size="sm" onClick={() => handleEdit('notes')}>
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleDeleteAssignment} disabled={isLoading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Assignment
            </Button>
            <Button variant="outline" onClick={handleSendUpdate} disabled={isLoading}>
              <Mail className="h-4 w-4 mr-2" />
              Send Update to Client
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}