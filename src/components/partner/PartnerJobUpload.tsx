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
        // Handle manual job creation via new edge function
        const { data: result, error } = await supabase.functions.invoke('partner-create-job', {
          body: {
            client_name: data.payload.client_name,
            client_email: data.payload.client_email,
            client_phone: data.payload.client_phone,
            job_address: data.payload.job_address,
            postcode: data.payload.postcode,
            job_type: data.payload.job_type,
            notes: data.payload.notes
          }
        });
        
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      toast({
        title: '✅ Success!',
        description: uploadType === 'csv' ? 'CSV uploaded successfully' : 'Job created successfully',
        duration: 5000,
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
                    onBlur={() => {
                      if (manualJob.postcode) {
                        const normalized = manualJob.postcode.replace(/\s/g, '').toUpperCase();
                        const formatted = normalized.replace(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/, '$1 $2');
                        setManualJob({ ...manualJob, postcode: formatted });
                      }
                    }}
                    placeholder="e.g., SW1A 1AA"
                    required
                  />
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