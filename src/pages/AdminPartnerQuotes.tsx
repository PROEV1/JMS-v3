
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings, AlertCircle } from 'lucide-react';
import { 
  PartnerQuoteKPIs, 
  PartnerQuoteFilters, 
  PartnerQuoteDrawer, 
  AddQuoteModal 
} from '@/components/partner-quotes';
import { PartnerQuoteSettingsModal } from '@/components/partner-quotes/PartnerQuoteSettingsModal';
import { PartnerQuoteStatusTabs } from '@/components/partner-quotes/PartnerQuoteStatusTabs';
import { PartnerQuoteList } from '@/components/partner-quotes/PartnerQuoteList';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  client: {
    full_name: string;
    email: string;
    postcode?: string;
  };
  partner: {
    name: string;
  };
  partner_status: string;
  partner_job_id: string;
  partner_external_id: string;
  job_type: 'installation' | 'assessment' | 'service_call';
  created_at: string;
  total_amount: number;
  partner_id: string;
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
  partner_external_url?: string;
  postcode: string;
  assigned_user?: string;
  require_file?: boolean;
  quote_override?: {
    id: string;
    override_type: 'quoted_pending_approval' | 'standard_quote_marked';
    notes?: string;
    created_at: string;
  };
  status_enhanced?: string;
}

export default function AdminPartnerQuotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { canManageQuotes, canManageOrders, loading: permissionsLoading } = usePermissions();
  
  // Extract partner ID from URL query parameter
  const queryPartnerId = searchParams.get('partnerId');
  
  // URL-driven state for active status
  const [activeStatus, setActiveStatus] = useState(
    searchParams.get('status') || 'needs_quotation'
  );
  
  const [selectedPartner, setSelectedPartner] = useState<string | null>(queryPartnerId || null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [jobs, setJobs] = useState<PartnerQuoteJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<PartnerQuoteJob | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [jobForQuote, setJobForQuote] = useState<PartnerQuoteJob | null>(null);
  const [partnerSettings, setPartnerSettings] = useState<any>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    job_type: 'all',
    date_range: 'all',
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
      fetchPartnerSettings(selectedPartner);
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
      
      // Auto-select first partner if available and no query partner ID is present
      if (data?.length > 0 && !queryPartnerId) {
        setSelectedPartner(data[0].id);
      } else if (queryPartnerId && data?.find(p => p.id === queryPartnerId)) {
        // Validate that the query partner ID exists in the partners list
        setSelectedPartner(queryPartnerId);
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

  const fetchPartnerSettings = async (partnerId: string) => {
    if (!partnerId) return;
    
    try {
      const { data, error } = await supabase
        .from('partner_quote_settings')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching partner settings:', error);
        return;
      }

      setPartnerSettings(data);
    } catch (error) {
      console.error('Error in fetchPartnerSettings:', error);
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
          partner_external_url,
          job_type,
          postcode,
          total_amount,
          created_at,
          partner_id,
          partner_external_id,
          status_enhanced,
          clients!inner(
            full_name,
            email,
            postcode
          ),
          partners!inner(
            name
          )
        `)
        .eq('is_partner_job', true)
        .eq('partner_id', selectedPartner);

      // Apply filters
      if (filters.job_type && filters.job_type !== 'all' && 
          ['installation', 'assessment', 'service_call'].includes(filters.job_type)) {
        query = query.eq('job_type', filters.job_type as 'installation' | 'assessment' | 'service_call');
      }

      if (filters.region) {
        query = query.ilike('postcode', `${filters.region}%`);
      }

      if (filters.date_range && filters.date_range !== 'all') {
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

      // Fetch quote overrides for these orders
      const orderIds = (data || []).map(job => job.id);
      const { data: overrides } = await supabase
        .from('partner_quote_overrides')
        .select('*')
        .in('order_id', orderIds)
        .is('cleared_at', null);

      const overrideMap = new Map(
        (overrides || []).map(override => [override.order_id, override])
      );

      const transformedJobs: PartnerQuoteJob[] = (data || []).map(job => ({
        id: job.id,
        order_number: job.order_number,
        client_name: job.clients.full_name,
        address: job.clients.postcode || 'No address',
        client: {
          full_name: job.clients.full_name,
          email: job.clients.email,
          postcode: job.clients.postcode
        },
        partner: {
          name: job.partners.name
        },
        partner_status: job.partner_status || 'NEW_JOB',
        partner_job_id: job.partner_external_id || job.order_number,
        partner_external_id: job.partner_external_id || job.order_number,
        job_type: job.job_type as 'installation' | 'assessment' | 'service_call',
        created_at: job.created_at,
        total_amount: job.total_amount || 0,
        partner_id: job.partner_id,
        partner_external_url: job.partner_external_url,
        postcode: job.postcode || job.clients.postcode || '',
        require_file: false,
        quote_override: overrideMap.get(job.id),
        status_enhanced: job.status_enhanced
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

  // Helper function to get jobs by status with new logic
  const getBucketJobs = (...statuses: string[]) => {
    return jobs.filter(job => {
      // Check for quote overrides first
      if (job.quote_override) {
        if (job.quote_override.override_type === 'quoted_pending_approval') {
          return statuses.includes('WAITING_FOR_APPROVAL');
        }
        if (job.quote_override.override_type === 'standard_quote_marked') {
          return statuses.includes('NEEDS_SCHEDULING');
        }
      }

      // Check partner status
      if (statuses.includes(job.partner_status)) {
        return true;
      }

      // For needs scheduling bucket, also check status_enhanced
      if (statuses.includes('NEEDS_SCHEDULING')) {
        return job.status_enhanced === 'awaiting_install_booking' ||
               job.partner_status === 'AWAITING_INSTALL_DATE' ||
               job.partner_status === 'INSTALL_DATE_CONFIRMED';
      }

      return false;
    });
  };

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    return {
      needs_quotation: getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION').length,
      waiting_approval: getBucketJobs('WAITING_FOR_APPROVAL', 'WAITING_FOR_OHME_APPROVAL').length,
      needs_scheduling: getBucketJobs('NEEDS_SCHEDULING').length,
      rejected_rework: getBucketJobs('REJECTED', 'REWORK_REQUESTED').length
    };
  }, [jobs]);

  // Active jobs for current status
  const activeJobs = useMemo(() => {
    switch (activeStatus) {
      case 'needs_quotation':
        return getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION');
      case 'waiting_approval':
        return getBucketJobs('WAITING_FOR_APPROVAL', 'WAITING_FOR_OHME_APPROVAL');
      case 'needs_scheduling':
        return getBucketJobs('NEEDS_SCHEDULING');
      case 'rejected_rework':
        return getBucketJobs('REJECTED', 'REWORK_REQUESTED');
      default:
        return getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION');
    }
  }, [jobs, activeStatus]);

  // Handle status change
  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    setSearchParams({ status });
  };

  const handleJobClick = (job: PartnerQuoteJob) => {
    setSelectedJob(job);
    setShowDrawer(true);
  };

  const handleMarkAsQuoted = async (job: PartnerQuoteJob, quoteType: 'custom' | 'standard') => {
    try {
      const overrideType = quoteType === 'standard' ? 'standard_quote_marked' : 'quoted_pending_approval';
      
      const { error } = await supabase
        .from('partner_quote_overrides')
        .insert({
          order_id: job.id,
          override_type: overrideType,
          notes: `Marked as ${quoteType} quote via admin interface`
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Job marked as ${quoteType} quote`,
      });

      // Refresh jobs to show updated status
      fetchJobs();
    } catch (error) {
      console.error('Error marking job as quoted:', error);
      toast({
        title: "Error",
        description: "Failed to mark job as quoted",
        variant: "destructive",
      });
    }
  };

  const handleClearOverride = async (job: PartnerQuoteJob) => {
    if (!job.quote_override) return;

    try {
      const { error } = await supabase
        .from('partner_quote_overrides')
        .update({ cleared_at: new Date().toISOString() })
        .eq('id', job.quote_override.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Quote override cleared",
      });

      fetchJobs();
    } catch (error) {
      console.error('Error clearing override:', error);
      toast({
        title: "Error",
        description: "Failed to clear override",
        variant: "destructive",
      });
    }
  };

  const handleOpenInPartner = (job: PartnerQuoteJob) => {
    const partnerUrl = `https://connect.ohme-ev.com/en/jobs/job/${job.partner_external_id}`;
    window.open(partnerUrl, '_blank');
  };

  // Permission check
  console.log('AdminPartnerQuotes permission check:', { 
    permissionsLoading, 
    canManageQuotes, 
    canManageOrders,
    userRole: role 
  });
  
  if (!permissionsLoading && !canManageQuotes && !canManageOrders && role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access Partner Quote Management. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !selectedPartner) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading partners...</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedPartnerName = partners.find(p => p.id === selectedPartner)?.name || '';

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Partner Quote Management</h1>
          
          {/* Partner Selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Partner:</span>
            <Select value={selectedPartner || ''} onValueChange={setSelectedPartner}>
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
            {selectedPartner && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettingsModal(true)}
                title="Partner Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {selectedPartner && (
          <>
            {/* KPIs */}
            <PartnerQuoteKPIs 
              partnerId={selectedPartner}
              jobs={jobs}
            />

            {/* Filters */}
            <PartnerQuoteFilters 
              filters={filters}
              onFiltersChange={setFilters}
            />

            <Separator />

            {/* Read-only banner for needs scheduling tab */}
            {activeStatus === 'needs_scheduling' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This tab is read-only. Jobs shown here are ready for scheduling and should be managed from the main Scheduling interface.
                </AlertDescription>
              </Alert>
            )}

            {/* Status Tabs */}
            <PartnerQuoteStatusTabs
              activeStatus={activeStatus}
              onStatusChange={handleStatusChange}
              statusCounts={statusCounts}
            />

            {/* Jobs List */}
            <PartnerQuoteList
              jobs={activeJobs}
              onJobClick={handleJobClick}
              onMarkAsQuoted={handleMarkAsQuoted}
              onClearOverride={handleClearOverride}
              onOpenInPartner={handleOpenInPartner}
              loading={loading}
              readOnly={activeStatus === 'needs_scheduling'}
            />
          </>
        )}
      </div>

      {/* Modals */}
      {selectedJob && (
        <PartnerQuoteDrawer
          job={selectedJob}
          open={showDrawer}
          onOpenChange={setShowDrawer}
          onQuoteUpdated={() => {
            fetchJobs();
            setShowDrawer(false);
          }}
          partnerName={selectedPartnerName}
          onMarkAsQuoted={handleMarkAsQuoted}
          onClearOverride={handleClearOverride}
        />
      )}

      {selectedPartner && (
        <PartnerQuoteSettingsModal
          open={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          partnerId={selectedPartner}
          partnerName={selectedPartnerName}
          onSettingsUpdated={() => {
            fetchPartnerSettings(selectedPartner);
          }}
        />
      )}
    </div>
  );
}
