
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PartnerQuoteFilters } from '@/components/partner-quotes/PartnerQuoteFilters';
import { PartnerQuoteKPIs } from '@/components/partner-quotes/PartnerQuoteKPIs';
import { PartnerQuoteJobCard } from '@/components/partner-quotes/PartnerQuoteJobCard';
import { PartnerQuoteDrawer } from '@/components/partner-quotes/PartnerQuoteDrawer';
import { AlertCircle, ExternalLink, Plus } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  partner_type: string;
}

interface PartnerQuoteJob {
  id: string;
  order_number: string;
  client_name: string;
  address: string;
  job_type: string;
  partner_status: string;
  partner_job_id: string;
  created_at: string;
  partner_id: string;
  latest_quote?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    submitted_at: string;
    file_url?: string;
    notes?: string;
  };
}

export default function AdminPartnerQuotes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [jobs, setJobs] = useState<PartnerQuoteJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<PartnerQuoteJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    job_type: '',
    date_range: '',
    assigned_user: '',
    quote_value_min: '',
    quote_value_max: ''
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchJobs();
    }
  }, [selectedPartner, filters]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_type')
        .order('name');

      if (error) throw error;

      setPartners(data || []);
      
      // Auto-select Ohme if available
      const ohmePartner = data?.find(p => p.name.toLowerCase().includes('ohme'));
      if (ohmePartner) {
        setSelectedPartner(ohmePartner.id);
      } else if (data?.length > 0) {
        setSelectedPartner(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast({
        title: "Error",
        description: "Failed to load partners",
        variant: "destructive",
      });
    }
  };

  const fetchJobs = async () => {
    if (!selectedPartner) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          partner_status,
          partner_job_id,
          created_at,
          partner_id,
          client:clients(full_name, address),
          partner_quotes_latest:partner_quotes_latest(
            id, amount, currency, status, submitted_at, file_url, notes
          )
        `)
        .eq('is_partner_job', true)
        .eq('partner_id', selectedPartner)
        .in('partner_status', [
          'AWAITING_QUOTATION',
          'QUOTE_SUBMITTED',
          'QUOTE_APPROVED', 
          'QUOTE_REJECTED',
          'QUOTE_REWORK_REQUESTED'
        ]);

      // Apply filters
      if (filters.region) {
        // This would need postcode prefix filtering - simplified for now
      }
      if (filters.job_type) {
        query = query.eq('job_type', filters.job_type);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const transformedJobs: PartnerQuoteJob[] = (data || []).map(job => ({
        id: job.id,
        order_number: job.order_number,
        client_name: job.client?.full_name || 'Unknown Client',
        address: job.client?.address || 'No address',
        job_type: 'EV Charger Installation', // Simplified for now
        partner_status: job.partner_status,
        partner_job_id: job.partner_job_id,
        created_at: job.created_at,
        partner_id: job.partner_id,
        latest_quote: job.partner_quotes_latest?.[0] || undefined
      }));

      setJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load partner jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJobClick = (job: PartnerQuoteJob) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const handleAddQuote = (job: PartnerQuoteJob) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const handleOpenInPartner = (job: PartnerQuoteJob) => {
    const selectedPartnerData = partners.find(p => p.id === selectedPartner);
    if (selectedPartnerData?.name.toLowerCase().includes('ohme')) {
      const url = `https://connect.ohme-ev.com/en/jobs/job/${job.partner_job_id}`;
      window.open(url, '_blank');
    } else {
      toast({
        title: "Link not available",
        description: "Partner link format not configured for this partner",
        variant: "destructive",
      });
    }
  };

  const getBucketJobs = (status: string) => {
    switch (status) {
      case 'needs_quotation':
        return jobs.filter(j => j.partner_status === 'AWAITING_QUOTATION');
      case 'waiting_approval':
        return jobs.filter(j => j.partner_status === 'QUOTE_SUBMITTED');
      case 'approved':
        return jobs.filter(j => j.partner_status === 'QUOTE_APPROVED');
      case 'rejected_rework':
        return jobs.filter(j => ['QUOTE_REJECTED', 'QUOTE_REWORK_REQUESTED'].includes(j.partner_status));
      default:
        return [];
    }
  };

  const selectedPartnerData = partners.find(p => p.id === selectedPartner);

  if (loading && !selectedPartner) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading partners...</p>
            </div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Partner Quote Management</h1>
              <p className="text-muted-foreground">
                Manage quotes for partner jobs across different workflows
              </p>
            </div>
            
            {/* Partner Selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Partner:</span>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPartner && (
            <>
              {/* KPI Bar */}
              <PartnerQuoteKPIs 
                partnerId={selectedPartner}
                jobs={jobs}
              />

              {/* Filters */}
              <PartnerQuoteFilters
                filters={filters}
                onFiltersChange={setFilters}
              />

              {/* Quote Buckets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Needs Quotation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Needs Quotation
                      <Badge variant="secondary">
                        {getBucketJobs('needs_quotation').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getBucketJobs('needs_quotation').map(job => (
                      <PartnerQuoteJobCard
                        key={job.id}
                        job={job}
                        onCardClick={() => handleJobClick(job)}
                        onAddQuote={() => handleAddQuote(job)}
                        onOpenInPartner={() => handleOpenInPartner(job)}
                        partnerName={selectedPartnerData?.name || ''}
                      />
                    ))}
                    {getBucketJobs('needs_quotation').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No jobs need quotation
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Waiting for Approval */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="h-4 w-4 bg-blue-500 rounded-full" />
                      Waiting for Approval
                      <Badge variant="secondary">
                        {getBucketJobs('waiting_approval').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getBucketJobs('waiting_approval').map(job => (
                      <PartnerQuoteJobCard
                        key={job.id}
                        job={job}
                        onCardClick={() => handleJobClick(job)}
                        onOpenInPartner={() => handleOpenInPartner(job)}
                        partnerName={selectedPartnerData?.name || ''}
                      />
                    ))}
                    {getBucketJobs('waiting_approval').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No quotes waiting for approval
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Approved */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="h-4 w-4 bg-green-500 rounded-full" />
                      Approved
                      <Badge variant="secondary">
                        {getBucketJobs('approved').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getBucketJobs('approved').map(job => (
                      <PartnerQuoteJobCard
                        key={job.id}
                        job={job}
                        onCardClick={() => handleJobClick(job)}
                        onOpenInPartner={() => handleOpenInPartner(job)}
                        partnerName={selectedPartnerData?.name || ''}
                        readOnly
                      />
                    ))}
                    {getBucketJobs('approved').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No approved quotes
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Rejected/Rework */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="h-4 w-4 bg-red-500 rounded-full" />
                      Rejected / Rework
                      <Badge variant="secondary">
                        {getBucketJobs('rejected_rework').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getBucketJobs('rejected_rework').map(job => (
                      <PartnerQuoteJobCard
                        key={job.id}
                        job={job}
                        onCardClick={() => handleJobClick(job)}
                        onAddQuote={() => handleAddQuote(job)}
                        onOpenInPartner={() => handleOpenInPartner(job)}
                        partnerName={selectedPartnerData?.name || ''}
                      />
                    ))}
                    {getBucketJobs('rejected_rework').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No quotes need rework
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        {/* Side Drawer */}
        {selectedJob && (
          <PartnerQuoteDrawer
            job={selectedJob}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onQuoteUpdated={fetchJobs}
            partnerName={selectedPartnerData?.name || ''}
          />
        )}
      </BrandContainer>
    </BrandPage>
  );
}
