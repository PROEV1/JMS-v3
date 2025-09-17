import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  MapPin, 
  Package, 
  User, 
  Phone, 
  Mail, 
  FileText,
  Upload,
  Download,
  Image as ImageIcon,
  ChevronLeft,
  CheckCircle,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import JobStatusUpdater from '@/components/engineer/JobStatusUpdater';
import CompletionChecklist from '@/components/engineer/CompletionChecklist';
import { EngineerMaterialsUsed } from '@/components/engineer/EngineerMaterialsUsed';
import { ChargerSection } from '@/components/engineer/ChargerSection';
import { OrderNotesSection } from '@/components/admin/sections/OrderNotesSection';

interface JobDetails {
  id: string;
  order_number: string;
  engineer_id: string;
  client: {
    full_name: string;
    phone: string;
    email: string;
  };
  job_address: string;
  postcode: string;
  fullAddress: string;
  scheduled_install_date: string | null;
  status: string;
  status_enhanced: string;
  product_details: string;
  total_amount: number;
  quote: {
    warranty_period: string;
    special_instructions: string | null;
  };
  engineer_notes: string | null;
  engineer_signed_off_at: string | null;
  engineer_signature_data: string | null;
  admin_qa_notes: string | null;
}

interface EngineerUpload {
  id: string;
  upload_type: string;
  file_name: string;
  file_url: string;
  description: string | null;
  uploaded_at: string;
}

export default function EngineerJobDetail() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [job, setJob] = useState<JobDetails | null>(null);
  const [uploads, setUploads] = useState<EngineerUpload[]>([]);
  const [clientFiles, setClientFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineerInfo, setEngineerInfo] = useState<any>(null);
  
  // Form states
  const [engineerNotes, setEngineerNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [isChecklistComplete, setIsChecklistComplete] = useState(false);

  const uploadTypes = [
    { key: 'pre_install', label: 'Pre-install site survey' },
    { key: 'electrical_work', label: 'Electrical preparation and cabling' },
    { key: 'mounting_bracket', label: 'Wall mounting bracket installed' },
    { key: 'final_install', label: 'Final installation (charging station mounted)' },
    { key: 'testing_verification', label: 'Testing and verification complete' },
    { key: 'issues', label: 'Any issues or obstructions on site' }
  ];

  useEffect(() => {
    if (jobId && user) {
      fetchJobDetails();
      fetchEngineerInfo();
      fetchUploads();
      fetchClientFiles();
    }
  }, [jobId, user]);

  const fetchEngineerInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setEngineerInfo(data);
      setSignerName(data.name);
    } catch (error) {
      console.error('Error fetching engineer info:', error);
    }
  };

  const fetchJobDetails = async () => {
    try {
      console.log('Fetching job details for jobId:', jobId);
      
      // First, fetch the order with direct client relationship
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          status_enhanced,
          engineer_id,
          client_id,
          job_address,
          postcode,
          scheduled_install_date,
          total_amount,
          engineer_notes,
          engineer_signed_off_at,
          engineer_signature_data,
          admin_qa_notes,
          quote:quotes(
            product_details,
            warranty_period,
            special_instructions
          )
        `)
        .eq('id', jobId)
        .maybeSingle();

      if (orderError) {
        console.error('Database error fetching order details:', orderError);
        throw orderError;
      }

      if (!orderData) {
        console.error('No order found with id:', jobId);
        toast({
          title: "Job Not Found",
          description: "The requested job could not be found",
          variant: "destructive",
        });
        navigate('/engineer/jobs');
        return;
      }

      // Fetch client details if client_id exists
      let clientData = null;
      if (orderData.client_id) {
        const { data, error: clientError } = await supabase
          .from('clients')
          .select('full_name, email, phone, address, postcode')
          .eq('id', orderData.client_id)
          .maybeSingle();

        if (clientError) {
          console.error('Error fetching client details:', clientError);
          toast({
            title: "Warning",
            description: "Could not load complete client information",
            variant: "default",
          });
        } else {
          clientData = data;
        }
      }

      console.log('Raw order data:', orderData);
      console.log('Client data:', clientData);

      // Construct full address using available data
      const constructFullAddress = () => {
        const jobAddress = orderData.job_address;
        const orderPostcode = orderData.postcode;
        const clientAddress = clientData?.address;
        const clientPostcode = clientData?.postcode;

        // Prioritize job address with order postcode, fallback to client data
        const address = jobAddress || clientAddress || 'Address not specified';
        const postcode = orderPostcode || clientPostcode || '';
        
        return postcode ? `${address}, ${postcode}` : address;
      };

      const formattedJob = {
        id: orderData.id,
        order_number: orderData.order_number,
        engineer_id: orderData.engineer_id,
        client: {
          full_name: clientData?.full_name || 'Unknown Client',
          phone: clientData?.phone || 'Not provided',
          email: clientData?.email || 'Not provided'
        },
        job_address: orderData.job_address || clientData?.address || 'Address not specified',
        postcode: orderData.postcode || clientData?.postcode || '',
        fullAddress: constructFullAddress(),
        scheduled_install_date: orderData.scheduled_install_date,
        status: orderData.status,
        status_enhanced: orderData.status_enhanced,
        product_details: orderData.quote?.product_details || 'Product details not available',
        total_amount: orderData.total_amount,
        quote: {
          warranty_period: orderData.quote?.warranty_period || 'Not specified',
          special_instructions: orderData.quote?.special_instructions
        },
        engineer_notes: orderData.engineer_notes,
        engineer_signed_off_at: orderData.engineer_signed_off_at,
        engineer_signature_data: orderData.engineer_signature_data,
        admin_qa_notes: orderData.admin_qa_notes
      };

      console.log('Formatted job data:', formattedJob);
      setJob(formattedJob);
      setEngineerNotes(formattedJob.engineer_notes || '');
      setIsCompleted(!!formattedJob.engineer_signed_off_at);
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast({
        title: "Error",
        description: "Failed to load job details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('engineer_uploads')
        .select('*')
        .eq('order_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  const fetchClientFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .or(`quote_id.eq.${job?.id},project_id.eq.${job?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientFiles(data || []);
    } catch (error) {
      console.error('Error fetching client files:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, uploadType: string) => {
    const file = event.target.files?.[0];
    if (!file || !engineerInfo) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `order-${jobId}/${uploadType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('engineer-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('engineer-uploads')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('engineer_uploads')
        .insert({
          order_id: jobId,
          engineer_id: engineerInfo.id,
          upload_type: uploadType,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size
        });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded",
        description: "Installation image uploaded successfully",
      });

      fetchUploads();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (uploadId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('engineer-uploads')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('engineer_uploads')
        .delete()
        .eq('id', uploadId);

      if (dbError) throw dbError;

      toast({
        title: "Image deleted",
        description: "Installation image removed successfully",
      });

      fetchUploads();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOff = async () => {
    if (!isCompleted || !signerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please confirm completion and enter your name",
        variant: "destructive",
      });
      return;
    }

    if (!isChecklistComplete) {
      toast({
        title: "Checklist Incomplete",
        description: "Please complete all checklist items before signing off",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          engineer_notes: engineerNotes,
          engineer_signed_off_at: new Date().toISOString(),
          engineer_signature_data: signerName,
          status: 'engineer_completed'
        })
        .eq('id', jobId);

      if (error) throw error;

      // Send completion notification to admins
      try {
        await supabase.functions.invoke('send-completion-notification', {
          body: {
            orderId: jobId,
            engineerName: engineerInfo?.name || signerName,
            orderNumber: job?.order_number,
            clientName: job?.client.full_name,
            jobAddress: job?.job_address
          }
        });
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Don't fail the sign-off if notification fails
      }

      toast({
        title: "Job Signed Off",
        description: "Installation has been marked as complete",
      });

      fetchJobDetails();
    } catch (error) {
      console.error('Error signing off job:', error);
      toast({
        title: "Error",
        description: "Failed to sign off job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReaccessJob = async () => {
    if (!jobId) {
      toast({
        title: "Error", 
        description: "Missing job information",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          engineer_signed_off_at: null,
          engineer_signature_data: null,
          status: 'in_progress'
        })
        .eq('id', jobId);

      if (error) throw error;

      // Log the reaccess activity
      await supabase.rpc('log_order_activity', {
        p_order_id: jobId,
        p_activity_type: 'job_reaccessed',
        p_description: `Job reaccessed by engineer ${engineerInfo?.name}`,
        p_details: {
          engineer_id: engineerInfo?.id,
          engineer_name: engineerInfo?.name,
          reaccessed_at: new Date().toISOString()
        }
      });

      toast({
        title: "Job Reaccessed",
        description: "You can now make changes and updates to this job",
      });

      // Refresh job details to show editing interfaces
      fetchJobDetails();
    } catch (error) {
      console.error('Error reaccessing job:', error);
      toast({
        title: "Error",
        description: "Failed to reaccess job",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) return <BrandLoading />;
  if (!job) return <div>Job not found</div>;

  return (
    <BrandPage>
      <BrandContainer>
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/engineer')}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <BrandHeading1>Job Details - {job.order_number}</BrandHeading1>
              <p className="text-muted-foreground">
                {job.engineer_signed_off_at ? 'Completed' : 'In Progress'}
              </p>
            </div>
            {job.engineer_signed_off_at && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-4 w-4 mr-1" />
                Signed Off
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          {/* Job Status Updates */}
          {!job.engineer_signed_off_at && (
            <JobStatusUpdater
              jobId={job.id}
              currentStatus={null}
              jobAddress={job.job_address}
              onStatusUpdate={fetchJobDetails}
            />
          )}

          {/* Client & Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Client & Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{job.client.full_name}</p>
                    <p className="text-sm text-muted-foreground">Client</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{job.client.phone}</p>
                    <p className="text-sm text-muted-foreground">Phone</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{job.client.email}</p>
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{job.fullAddress}</p>
                    <p className="text-sm text-muted-foreground">Full Address</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formatDate(job.scheduled_install_date)}</p>
                    <p className="text-sm text-muted-foreground">Scheduled Date</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{job.product_details}</p>
                    <p className="text-sm text-muted-foreground">Product</p>
                  </div>
                </div>
              </div>
              
              {job.quote.special_instructions && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-2">Special Instructions</h4>
                  <p className="text-sm text-amber-700">{job.quote.special_instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installation Images Upload */}
          {!job.engineer_signed_off_at && (
            <Card>
              <CardHeader>
                <CardTitle>Installation Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploadTypes.map((type) => {
                    const existingUpload = uploads.find(u => u.upload_type === type.key);
                    return (
                      <div key={type.key} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{type.label}</h4>
                          {existingUpload && (
                            <Badge variant="secondary" className="text-xs">
                              Uploaded
                            </Badge>
                          )}
                        </div>
                        
                        {existingUpload ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <img 
                                src={existingUpload.file_url} 
                                alt={type.label}
                                className="w-full h-32 object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1"
                                onClick={() => {
                                  const fileName = existingUpload.file_url.split('/').pop();
                                  handleDeleteImage(existingUpload.id, `order-${jobId}/${fileName}`);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(existingUpload.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, type.key)}
                              className="hidden"
                              id={`upload-${type.key}`}
                              disabled={uploading}
                            />
                            <label 
                              htmlFor={`upload-${type.key}`}
                              className="cursor-pointer"
                            >
                              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-xs text-muted-foreground">
                                Click to upload
                              </p>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completion Checklist */}
          {!job.engineer_signed_off_at && (
            <CompletionChecklist
              jobId={job.id}
              onChecklistChange={(items, isComplete) => {
                setChecklistItems(items);
                setIsChecklistComplete(isComplete);
              }}
            />
          )}

          {/* Materials Used */}
          {!job.engineer_signed_off_at && (
            <EngineerMaterialsUsed 
              orderId={job.id} 
              engineerId={job.engineer_id || ""} 
            />
          )}

          {/* Charger Section */}
          {!job.engineer_signed_off_at && (
            <ChargerSection
              orderId={job.id} 
              engineerId={job.engineer_id || ""} 
            />
          )}

          {/* Order Notes */}
          <OrderNotesSection 
            orderId={job.id} 
            onUpdate={fetchJobDetails}
          />

          {/* Engineer Notes & Sign-off */}
          {!job.engineer_signed_off_at && (
            <Card>
              <CardHeader>
                <CardTitle>Engineer Notes & Sign-off</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="engineer-notes">Installation Notes</Label>
                  <Textarea
                    id="engineer-notes"
                    placeholder="Enter observations, adjustments made, tools used, or any issues encountered..."
                    value={engineerNotes}
                    onChange={(e) => setEngineerNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="completion-check"
                      checked={isCompleted}
                      onCheckedChange={(checked) => setIsCompleted(checked === true)}
                    />
                    <Label htmlFor="completion-check" className="font-medium">
                      I confirm the installation is complete and working as intended
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor="signer-name">Digital Signature</Label>
                    <Input
                      id="signer-name"
                      placeholder="Enter your full name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleSignOff}
                    disabled={!isCompleted || !signerName.trim() || saving}
                    className="w-full"
                    size="lg"
                  >
                    {saving ? "Signing Off..." : "Sign Off Installation"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Installation Summary */}
          {job.engineer_signed_off_at && (
            <Card>
              <CardHeader>
                <CardTitle>Installation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {job.engineer_notes && (
                  <div>
                    <Label>Engineer Notes</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="text-sm">{job.engineer_notes}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Signed off by</Label>
                    <p className="font-medium">{job.engineer_signature_data}</p>
                  </div>
                  <div>
                    <Label>Completion Date</Label>
                    <p className="font-medium">{formatDate(job.engineer_signed_off_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="border rounded-lg overflow-hidden">
                      <img 
                        src={upload.file_url} 
                        alt={uploadTypes.find(t => t.key === upload.upload_type)?.label}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs font-medium">
                          {uploadTypes.find(t => t.key === upload.upload_type)?.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="flex justify-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={saving}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reaccess Job
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reaccess This Job?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reopen the job for editing. You'll be able to:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Add more installation images</li>
                            <li>Update or add engineer notes</li>
                            <li>Update job status</li>
                            <li>Re-complete the checklist if needed</li>
                          </ul>
                          <br />
                          The admin team will be notified that this job has been reopened. You'll need to sign off again when finished.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReaccessJob} disabled={saving}>
                          {saving ? "Reopening..." : "Reaccess Job"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </BrandContainer>
    </BrandPage>
  );
}