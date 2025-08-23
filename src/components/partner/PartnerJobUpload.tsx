import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PartnerUser {
  id: string;
  partner_id: string;
  role: string;
  partner: {
    name: string;
  };
}

interface PartnerJobUploadProps {
  partnerUser: PartnerUser;
}

export function PartnerJobUpload({ partnerUser }: PartnerJobUploadProps) {
  const [uploadType, setUploadType] = useState<'csv' | 'manual'>('manual');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualJob, setManualJob] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    job_address: '',
    postcode: '',
    job_type: 'installation',
    notes: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (data: { type: 'csv' | 'manual'; payload: any }) => {
      if (data.type === 'csv') {
        // Handle CSV upload via edge function
        const formData = new FormData();
        formData.append('file', data.payload.file);
        formData.append('partner_id', partnerUser.partner_id);
        
        const { data: result, error } = await supabase.functions.invoke('partner-job-upload', {
          body: formData
        });
        
        if (error) throw error;
        return result;
      } else {
        // Handle manual job creation
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .insert({
            full_name: data.payload.client_name,
            email: data.payload.client_email,
            phone: data.payload.client_phone,
            address: data.payload.job_address,
            postcode: data.payload.postcode,
            is_partner_client: true,
            partner_id: partnerUser.partner_id
          })
          .select()
          .single();

        if (clientError) throw clientError;

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_id: client.id,
            partner_id: partnerUser.partner_id,
            is_partner_job: true,
            job_type: data.payload.job_type,
            job_address: data.payload.job_address,
            postcode: data.payload.postcode,
            installation_notes: data.payload.notes,
            status: 'awaiting_payment',
            total_amount: 0,
            order_number: 'TEMP'
          })
          .select()
          .single();

        if (orderError) throw orderError;
        return order;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: uploadType === 'csv' ? 'CSV uploaded successfully' : 'Job created successfully'
      });
      
      // Reset forms
      setCsvFile(null);
      setManualJob({
        client_name: '',
        client_email: '',
        client_phone: '',
        job_address: '',
        postcode: '',
        job_type: 'installation',
        notes: ''
      });
      
      // Refresh partner jobs
      queryClient.invalidateQueries({ queryKey: ['partner-jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload job',
        variant: 'destructive'
      });
    }
  });

  const handleCsvUpload = () => {
    if (!csvFile) return;
    uploadMutation.mutate({ type: 'csv', payload: { file: csvFile } });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate({ type: 'manual', payload: manualJob });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* CSV Upload */}
        <Card className={uploadType === 'csv' ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              Bulk Upload (CSV)
            </CardTitle>
            <CardDescription>
              Upload multiple jobs at once using a CSV file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={uploadType === 'csv' ? 'default' : 'outline'}
              onClick={() => setUploadType('csv')}
              className="w-full"
            >
              Select CSV Upload
            </Button>
            
            {uploadType === 'csv' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Choose CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                </div>
                
                <Alert>
                  <AlertDescription>
                    CSV should include columns: client_name, client_email, client_phone, 
                    job_address, postcode, job_type (installation/service/assessment)
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card className={uploadType === 'manual' ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Manual Entry
            </CardTitle>
            <CardDescription>
              Enter job details manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={uploadType === 'manual' ? 'default' : 'outline'}
              onClick={() => setUploadType('manual')}
              className="w-full"
            >
              Select Manual Entry
            </Button>
            
            {uploadType === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client_name">Client Name</Label>
                    <Input
                      id="client_name"
                      value={manualJob.client_name}
                      onChange={(e) => setManualJob({ ...manualJob, client_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="client_email">Email</Label>
                    <Input
                      id="client_email"
                      type="email"
                      value={manualJob.client_email}
                      onChange={(e) => setManualJob({ ...manualJob, client_email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client_phone">Phone</Label>
                    <Input
                      id="client_phone"
                      value={manualJob.client_phone}
                      onChange={(e) => setManualJob({ ...manualJob, client_phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={manualJob.postcode}
                      onChange={(e) => setManualJob({ ...manualJob, postcode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="job_address">Job Address</Label>
                  <Input
                    id="job_address"
                    value={manualJob.job_address}
                    onChange={(e) => setManualJob({ ...manualJob, job_address: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={manualJob.notes}
                    onChange={(e) => setManualJob({ ...manualJob, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Job
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}