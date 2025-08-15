import { OrderSection } from "../OrderSectionLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  FileImage, 
  FileText, 
  Calendar,
  Save,
  CheckCircle2,
  User,
  Signature,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface EngineerUpload {
  id: string;
  file_name: string;
  file_url: string;
  upload_type: string;
  description: string | null;
  uploaded_at: string;
}

interface ChecklistItem {
  id: string;
  item_id: string;
  item_label: string;
  item_description?: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface Order {
  id: string;
  admin_qa_notes: string | null;
  engineer_notes?: string;
  engineer_signed_off_at?: string;
  engineer_signature_data?: string;
  engineer_uploads?: EngineerUpload[];
  engineer?: {
    name: string;
  };
}

interface EngineerUploadsSectionProps {
  order: Order;
  onUpdate: () => void;
}

export function EngineerUploadsSection({ order, onUpdate }: EngineerUploadsSectionProps) {
  const { toast } = useToast();
  const [qaNotesLocal, setQaNotesLocal] = useState(order.admin_qa_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // Load checklist items
  useEffect(() => {
    const loadChecklistItems = async () => {
      try {
        const { data, error } = await supabase
          .from('order_completion_checklist')
          .select('*')
          .eq('order_id', order.id)
          .order('item_id');

        if (error) throw error;
        setChecklistItems(data || []);
      } catch (error) {
        console.error('Error loading checklist items:', error);
      }
    };

    loadChecklistItems();
  }, [order.id]);

  const handleSaveQANotes = async () => {
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ admin_qa_notes: qaNotesLocal || null })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "QA Notes Updated",
        description: "Quality assurance notes have been saved successfully.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating QA notes:', error);
      toast({
        title: "Error",
        description: "Failed to update QA notes",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return FileImage;
    }
    return FileText;
  };

  const getUploadTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'completion_photo': return 'bg-green-100 text-green-800';
      case 'progress_photo': return 'bg-blue-100 text-blue-800';
      case 'issue_report': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not available';
    return format(new Date(dateString), 'PPP p');
  };

  const hasUploads = order.engineer_uploads && order.engineer_uploads.length > 0;
  const hasChangedNotes = qaNotesLocal !== (order.admin_qa_notes || '');
  const completedCount = checklistItems.filter(item => item.is_completed).length;
  const totalCount = checklistItems.length;

  return (
    <OrderSection 
      id="engineer-uploads" 
      title="Engineer Installation Documentation" 
      icon={Upload} 
      defaultOpen={hasUploads || Boolean(order.engineer_signed_off_at)}
    >
      <div className="space-y-6">
        {/* Engineer Sign-off Status */}
        {order.engineer_signed_off_at && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Installation Completed & Signed Off
                  </h3>
                  <div className="mt-1 text-sm text-green-700">
                    <p>Completed by: {order.engineer?.name || 'Engineer'}</p>
                    <p>Date: {formatDate(order.engineer_signed_off_at)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion Checklist Summary */}
        {checklistItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>Installation Checklist ({completedCount}/{totalCount})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                      item.is_completed 
                        ? 'bg-green-100 border-green-500' 
                        : 'border-gray-300'
                    }`}>
                      {item.is_completed && (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.item_label}</div>
                      {item.item_description && (
                        <div className="text-xs text-muted-foreground">{item.item_description}</div>
                      )}
                      {item.completed_at && (
                        <div className="text-xs text-green-600 flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Completed: {formatDate(item.completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engineer Notes */}
        {order.engineer_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Engineer Installation Notes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{order.engineer_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Engineer Signature */}
        {order.engineer_signature_data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <Signature className="h-5 w-5" />
                <span>Engineer Signature</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50">
                <img 
                  src={order.engineer_signature_data} 
                  alt="Engineer Signature" 
                  className="max-w-full h-auto max-h-32"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Engineer Uploads */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Uploaded Files</span>
          </h3>
          {hasUploads ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {order.engineer_uploads!.length} file{order.engineer_uploads!.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {order.engineer_uploads!.map((upload) => {
                  const IconComponent = getFileIcon(upload.file_name);
                  return (
                    <Card key={upload.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <IconComponent className="h-8 w-8 text-muted-foreground mt-1" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-medium truncate">{upload.file_name}</h5>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getUploadTypeColor(upload.upload_type)}`}
                              >
                                {upload.upload_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            {upload.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {upload.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(upload.uploaded_at), 'PPP p')}</span>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-3 w-full"
                              onClick={() => window.open(upload.file_url, '_blank')}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              View File
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No engineer uploads yet</p>
              <p className="text-xs">Files will appear here once the engineer uploads them</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Admin QA Notes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="qa-notes">Admin QA Notes</Label>
            {hasChangedNotes && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </div>
          
          <Textarea
            id="qa-notes"
            placeholder="Quality assurance notes, completion verification, any issues found..."
            value={qaNotesLocal}
            onChange={(e) => setQaNotesLocal(e.target.value)}
            rows={4}
          />
          
          <p className="text-xs text-muted-foreground">
            These notes are for internal admin use and quality control tracking
          </p>

          {hasChangedNotes && (
            <Button 
              onClick={handleSaveQANotes}
              disabled={isSavingNotes}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSavingNotes ? "Saving..." : "Save QA Notes"}
            </Button>
          )}
        </div>
      </div>
    </OrderSection>
  );
}