import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, Plus, Loader2, Search } from 'lucide-react';
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
    house_number: '',
    job_type: 'installation',
    notes: ''
  });
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const postcodeLogicMutation = useMutation({
    mutationFn: async (params: { postcode: string; house_number?: string }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('postcode', params.postcode);
      if (params.house_number) {
        searchParams.set('house_number', params.house_number);
      }
      
      const response = await fetch(
        `https://qvppvstgconmzzjsryna.supabase.co/functions/v1/postcode-lookup?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cHB2c3RnY29ubXp6anNyeW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYxNjEsImV4cCI6MjA3MDgzMjE2MX0.3hJXqRe_xTpIhdIIEDBgG-8qc23UCRMwpLaf2zV0Se8`,
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to lookup postcode');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      setAddressResults(result.addresses || []);
    },
    onError: (error: any) => {
      toast({
        title: 'Address Lookup Failed',
        description: error.message || 'Could not find addresses for this postcode',
        variant: 'destructive'
      });
      setAddressResults([]);
    }
  });

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
        house_number: '',
        job_type: 'installation',
        notes: ''
      });
      setAddressResults([]);
      
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

  const handleAddressLookup = async () => {
    if (!manualJob.postcode.trim()) {
      toast({
        title: 'Postcode Required',
        description: 'Please enter a postcode to search for addresses',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLookingUp(true);
    try {
      await postcodeLogicMutation.mutateAsync({
        postcode: manualJob.postcode,
        house_number: manualJob.house_number || undefined
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSelectAddress = (address: any) => {
    setManualJob({
      ...manualJob,
      job_address: address.address,
      postcode: address.postcode
    });
    setAddressResults([]);
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
                    <Label htmlFor="house_number">House No. (Optional)</Label>
                    <Input
                      id="house_number"
                      value={manualJob.house_number}
                      onChange={(e) => setManualJob({ ...manualJob, house_number: e.target.value })}
                      placeholder="e.g., 123 or Flat 4A"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <div className="flex gap-2">
                    <Input
                      id="postcode"
                      value={manualJob.postcode}
                      onChange={(e) => {
                        setManualJob({ ...manualJob, postcode: e.target.value });
                        setAddressResults([]);
                      }}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddressLookup}
                      disabled={isLookingUp || !manualJob.postcode.trim()}
                    >
                      {isLookingUp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {addressResults.length > 0 && (
                    <div className="mt-2 border rounded-md bg-background">
                      <div className="p-2 text-sm font-medium border-b">Select Address:</div>
                      <div className="max-h-40 overflow-y-auto">
                        {addressResults.map((address, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
                            onClick={() => handleSelectAddress(address)}
                          >
                            {address.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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