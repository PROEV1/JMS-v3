import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { PartnerQuoteFilters } from '@/components/partner-quotes/PartnerQuoteFilters';
import { PartnerQuoteKPIs } from '@/components/partner-quotes/PartnerQuoteKPIs';
import { PartnerQuoteJobCard } from '@/components/partner-quotes/PartnerQuoteJobCard';
import { PartnerQuoteDrawer } from '@/components/partner-quotes/PartnerQuoteDrawer';
import { AddQuoteModal } from '@/components/partner-quotes/AddQuoteModal';
import { AlertCircle, ExternalLink, Plus, Shield, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

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
  job_type: 'installation' | 'assessment' | 'service_call';
  partner_status: string;
  partner_job_id: string;
  partner_external_id: string;
  created_at: string;
  partner_id: string;
  postcode: string;
  total_amount: number;
  latest_quote?: {
    id: string;
    amount: number;
    currency: string;
    status: 'submitted' | 'approved' | 'rejected' | 'rework' | 'withdrawn';
    submitted_at: string;
    decision_at?: string;
    file_url?: string;
    notes?: string;
    decision_notes?: string;
  };
  sla_hours?: number;
  require_file?: boolean;
}

export default function AdminPartnerQuotes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { canManageQuotes, canManageOrders, loading: permissionsLoading } = usePermissions();
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [jobs, setJobs] = useState<PartnerQuoteJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<PartnerQuoteJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [partnerSettings, setPartnerSettings] = useState<Record<string, any>>({});
  const [addQuoteOpen, setAddQuoteOpen] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    job_type: '',
    date_range: '',
    assigned_user: '',
    quote_value_min: '',
    quote_value_max: ''
  });

  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounce(filters, 500);

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchJobs();
      fetchPartnerSettings();
    }
  }, [selectedPartner, debouncedFilters]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_type')
        .order('name');

      if (error) throw error;

      setPartners(data || []);
      
      // Auto-select first partner if available
      if (data?.length > 0) {
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

  const fetchPartnerSettings = async () => {
    if (!selectedPartner) return;
    
    try {
      const { data, error } = await supabase
        .from('partner_quote_settings')
        .select('*')
        .eq('partner_id', selectedPartner)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Use defaults if no settings found
      setPartnerSettings(data || {
        enabled: true,
        sla_hours: 24,
        auto_hide_days: 7,
        require_file: true,
        notifications: { sla_breach: true, new_quote: true }
      });
    } catch (error) {
      console.error('Error fetching partner settings:', error);
      setPartnerSettings({
        enabled: true,
        sla_hours: 24,
        auto_hide_days: 7,
        require_file: true,
        notifications: { sla_breach: true, new_quote: true }
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
          partner_external_id,
          job_type,
          postcode,
          total_amount,
          created_at,
          partner_id,
          client:clients(full_name, address),
          partner_quotes_latest(
            id,
            amount,
            currency,
            status,
            submitted_at,
            decision_at,
            file_url,
            notes,
            decision_notes
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
      if (filters.job_type && ['installation', 'assessment', 'service_call'].includes(filters.job_type)) {
        query = query.eq('job_type', filters.job_type as 'installation' | 'assessment' | 'service_call');
      }

      if (filters.region) {
        query = query.ilike('postcode', `${filters.region}%`);
      }

      if (filters.date_range) {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.date_range) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      if (filters.quote_value_min) {
        query = query.gte('total_amount', parseFloat(filters.quote_value_min));
      }

      if (filters.quote_value_max) {
        query = query.lte('total_amount', parseFloat(filters.quote_value_max));
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const transformedJobs: PartnerQuoteJob[] = (data || []).map(job => ({
        id: job.id,
        order_number: job.order_number,
        client_name: job.client?.full_name || 'Unknown Client',
        address: job.client?.address || 'No address',
        job_type: job.job_type,
        partner_status: job.partner_status,
        partner_job_id: job.partner_external_id || job.order_number,
        partner_external_id: job.partner_external_id || job.order_number,
        created_at: job.created_at,
        partner_id: job.partner_id,
        postcode: job.postcode || '',
        total_amount: job.total_amount || 0,
        latest_quote: job.partner_quotes_latest?.[0] || undefined,
        sla_hours: partnerSettings.sla_hours || 24,
        require_file: partnerSettings.require_file || false
      }));

      // Apply auto-hide for approved quotes
      const autoHideDays = partnerSettings.auto_hide_days || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - autoHideDays);
      
      const filteredJobs = transformedJobs.filter(job => {
        if (job.partner_status === 'QUOTE_APPROVED' && job.latest_quote?.decision_at) {
          const decisionDate = new Date(job.latest_quote.decision_at);
          return decisionDate >= cutoffDate;
        }
        return true;
      });

      setJobs(filteredJobs);
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
    setAddQuoteOpen(true);
  };

  const handleOpenInPartner = (job: PartnerQuoteJob) => {
    const selectedPartnerData = partners.find(p => p.id === selectedPartner);
    if (selectedPartnerData?.name.toLowerCase().includes('ohme')) {
      const url = `https://connect.ohme-ev.com/en/jobs/job/${job.partner_external_id}`;
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
  const isReadOnly = !canManageQuotes && !canManageOrders;

  // Permission check - but allow admin users through
  console.log('AdminPartnerQuotes permission check:', { 
    permissionsLoading, 
    canManageQuotes, 
    canManageOrders,
    userRole: role 
  });
  
  if (!permissionsLoading && !canManageQuotes && !canManageOrders) {
    // Allow admin users through even if permissions haven't loaded yet
    if (role === 'admin') {
      console.log('Admin user detected, allowing access despite permission check');
    } else {
      return (
        <BrandPage>
          <BrandContainer>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to access Partner Quote Management. Please contact your administrator.
              </AlertDescription>
            </Alert>
          </BrandContainer>
        </BrandPage>
      );
    }
  }

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
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading jobs...</span>
                  </div>
                </div>
              ) : (
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
        onAddQuote={!isReadOnly ? () => handleAddQuote(job) : undefined}
        onOpenInPartner={() => handleOpenInPartner(job)}
        partnerName={selectedPartnerData?.name || ''}
        readOnly={isReadOnly}
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
        onAddQuote={!isReadOnly ? () => handleAddQuote(job) : undefined}
        onOpenInPartner={() => handleOpenInPartner(job)}
        partnerName={selectedPartnerData?.name || ''}
        readOnly={isReadOnly}
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
              )}
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

        {/* Add Quote Modal */}
        {selectedJob && (
          <AddQuoteModal
            job={selectedJob}
            open={addQuoteOpen}
            onOpenChange={setAddQuoteOpen}
            onQuoteAdded={fetchJobs}
            partnerName={selectedPartnerData?.name || ''}
          />
        )}
      </BrandContainer>
    </BrandPage>
  );
}
