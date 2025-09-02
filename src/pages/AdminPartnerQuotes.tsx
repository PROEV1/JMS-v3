
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
  scheduled_install_date?: string;
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
  const [dataTruncated, setDataTruncated] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchedCount, setFetchedCount] = useState(0);

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
      
      // Auto-select partner: prefer Ohme, fallback to first partner
      if (data?.length > 0 && !queryPartnerId) {
        const ohmePartner = data.find(p => p.name.toLowerCase().includes('ohme'));
        const preferredPartner = ohmePartner || data[0];
        setSelectedPartner(preferredPartner.id);
        // Update URL to reflect selected partner
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('partnerId', preferredPartner.id);
          return newParams;
        });
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
      // Fetch both partner settings and import profiles
      const [settingsResult, profilesResult] = await Promise.all([
        supabase
          .from('partner_quote_settings')
          .select('*')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('partner_import_profiles')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
      ]);

      if (settingsResult.error) {
        console.error('Error fetching partner settings:', settingsResult.error);
      }

      if (profilesResult.error) {
        console.error('Error fetching import profiles:', profilesResult.error);
      }

      // Combine settings and import profiles
      const combinedSettings = {
        ...settingsResult.data,
        import_profiles: profilesResult.data || []
      };

      setPartnerSettings(combinedSettings);
    } catch (error) {
      console.error('Error in fetchPartnerSettings:', error);
    }
  };

  // Helper function for paginated fetching
  const fetchJobsPaginated = async (partnerIds: string[], baseQuery: any) => {
    const pageSize = 1000;
    let allJobs: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await baseQuery
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        allJobs = [...allJobs, ...data];
        offset += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allJobs;
  };

  const fetchJobs = async () => {
    if (!selectedPartner) return;
    
    setLoading(true);
    setDataTruncated(false);
    
    try {
      // First, get child partners to include in the query
      const { data: childPartners } = await supabase
        .from('partners')
        .select('id')
        .eq('parent_partner_id', selectedPartner);

      const partnerIds = [selectedPartner, ...(childPartners?.map(p => p.id) || [])];

      // Get total count first with status/schedule filtering
      let countQuery = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('is_partner_job', true)
        .in('partner_id', partnerIds);

      // Add status/schedule OR filter for relevant jobs
      countQuery = countQuery.or('partner_status.in.(AWAITING_QUOTATION,WAITING_FOR_OHME_APPROVAL,WAITING_FOR_APPROVAL,REWORK_REQUESTED,REJECTED),scheduled_install_date.not.is.null');

      // Build the main query with status/schedule filtering
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
          scheduled_install_date,
          clients(
            full_name,
            email,
            postcode
          ),
          partners(
            name
          )
        `)
        .eq('is_partner_job', true)
        .in('partner_id', partnerIds);

      // Add status/schedule OR filter - focus on relevant statuses and scheduled jobs
      query = query.or('partner_status.in.(AWAITING_QUOTATION,WAITING_FOR_OHME_APPROVAL,WAITING_FOR_APPROVAL,REWORK_REQUESTED,REJECTED),scheduled_install_date.not.is.null');

      // Apply user filters
      if (filters.job_type && filters.job_type !== 'all' && 
          ['installation', 'assessment', 'service_call'].includes(filters.job_type)) {
        query = query.eq('job_type', filters.job_type as 'installation' | 'assessment' | 'service_call');
        countQuery = countQuery.eq('job_type', filters.job_type as 'installation' | 'assessment' | 'service_call');
      }

      if (filters.region) {
        query = query.ilike('postcode', `${filters.region}%`);
        countQuery = countQuery.ilike('postcode', `${filters.region}%`);
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
        countQuery = countQuery.gte('created_at', startDate.toISOString());
      }

      if (filters.quote_value_min) {
        query = query.gte('total_amount', parseFloat(filters.quote_value_min));
        countQuery = countQuery.gte('total_amount', parseFloat(filters.quote_value_min));
      }

      if (filters.quote_value_max) {
        query = query.lte('total_amount', parseFloat(filters.quote_value_max));
        countQuery = countQuery.lte('total_amount', parseFloat(filters.quote_value_max));
      }

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      
      // Fetch all relevant jobs using pagination
      const data = await fetchJobsPaginated(partnerIds, query);

      setTotalCount(count || 0);
      setFetchedCount(data.length);
      setDataTruncated((count || 0) > data.length);

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
        client_name: job.clients?.full_name || 'Unknown Client',
        address: job.clients?.postcode || 'No address',
        client: {
          full_name: job.clients?.full_name || 'Unknown Client',
          email: job.clients?.email || '',
          postcode: job.clients?.postcode
        },
        partner: {
          name: job.partners?.name || 'Unknown Partner'
        },
        partner_status: job.partner_status || 'NEW_JOB',
        partner_job_id: job.partner_external_id || job.order_number,
        partner_external_id: job.partner_external_id || job.order_number,
        job_type: job.job_type as 'installation' | 'assessment' | 'service_call',
        created_at: job.created_at,
        total_amount: job.total_amount || 0,
        partner_id: job.partner_id,
        partner_external_url: job.partner_external_url,
        postcode: job.postcode || job.clients?.postcode || '',
        require_file: false,
        quote_override: overrideMap.get(job.id),
        status_enhanced: job.status_enhanced,
        scheduled_install_date: job.scheduled_install_date
      }));

      setJobs(transformedJobs);

      // Console logging for diagnostics
      console.log('Partner Jobs Fetch Summary:', {
        partnerId: selectedPartner,
        partnerName: partners.find(p => p.id === selectedPartner)?.name,
        totalCount: count || 0,
        fetchedCount: data.length,
        dataTruncated: (count || 0) > data.length,
        statusBreakdown: {
          AWAITING_QUOTATION: transformedJobs.filter(j => j.partner_status === 'AWAITING_QUOTATION').length,
          WAITING_FOR_APPROVAL: transformedJobs.filter(j => j.partner_status === 'WAITING_FOR_APPROVAL').length,
          WAITING_FOR_OHME_APPROVAL: transformedJobs.filter(j => j.partner_status === 'WAITING_FOR_OHME_APPROVAL').length,
          REWORK_REQUESTED: transformedJobs.filter(j => j.partner_status === 'REWORK_REQUESTED').length,
          REJECTED: transformedJobs.filter(j => j.partner_status === 'REJECTED').length,
          scheduled: transformedJobs.filter(j => j.scheduled_install_date).length
        }
      });

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

  // Normalize partner status to handle variations
  const normalizePartnerStatus = (status: string) => {
    if (status === 'WAITING_FOR_OHME_APPROVAL') return 'WAITING_FOR_APPROVAL';
    return status;
  };

  // Helper to check if job should be in review bucket (has scheduled date AND awaiting approval)
  const isReview = (job: PartnerQuoteJob) => {
    const approvalStatuses = ['WAITING_FOR_APPROVAL', 'WAITING_FOR_OHME_APPROVAL'];
    const normalizedStatus = normalizePartnerStatus(job.partner_status);
    
    // A job is in review if it has approval status AND has been scheduled
    const isApprovalStatus = approvalStatuses.includes(job.partner_status) || normalizedStatus === 'WAITING_FOR_APPROVAL';
    const hasScheduledDate = job.scheduled_install_date || 
                           job.status_enhanced === 'scheduled' || 
                           job.status_enhanced === 'in_progress' || 
                           job.status_enhanced === 'install_completed_pending_qa' ||
                           job.status_enhanced === 'completed';
    
    return isApprovalStatus && hasScheduledDate;
  };

  // Helper function to get jobs by status with normalized logic
  const getBucketJobs = (...statuses: string[]) => {
    const filteredJobs = jobs.filter(job => {
      const normalizedStatus = normalizePartnerStatus(job.partner_status);
      
      // Check for quote overrides first
      if (job.quote_override) {
        if (job.quote_override.override_type === 'quoted_pending_approval') {
          return statuses.includes('WAITING_FOR_APPROVAL');
        }
        if (job.quote_override.override_type === 'standard_quote_marked') {
          return statuses.includes('NEEDS_SCHEDULING');
        }
      }

      // Check import profile status mappings if available
      if (partnerSettings?.import_profiles?.length > 0) {
        const activeProfile = partnerSettings.import_profiles.find((p: any) => p.is_active);
        if (activeProfile?.status_actions) {
          const statusAction = activeProfile.status_actions[job.partner_status];
          if (statusAction?.include_in_quote_dashboard && statusAction.quote_bucket) {
            const bucketMapping = {
              'needs_quotation': ['AWAITING_QUOTATION'],
              'waiting_approval': ['WAITING_FOR_APPROVAL'],
              'review': ['REVIEW'],
              'needs_scheduling': ['NEEDS_SCHEDULING'],
              'rejected_rework': ['REJECTED', 'REWORK_REQUESTED']
            };
            
            const targetBucket = statusAction.quote_bucket;
            if (bucketMapping[targetBucket]) {
              return statuses.some(s => bucketMapping[targetBucket].includes(s));
            }
          }
        }
      }

      // Special handling for review bucket
      if (statuses.includes('REVIEW')) {
        return isReview(job);
      }

      // For waiting approval, exclude review jobs
      if (statuses.includes('WAITING_FOR_APPROVAL')) {
        if (isReview(job)) return false; // Exclude review jobs from waiting approval
        // Include both normalized status and original status
        return normalizedStatus === 'WAITING_FOR_APPROVAL' || job.partner_status === 'WAITING_FOR_OHME_APPROVAL';
      }

      // Check normalized partner status
      if (statuses.includes(normalizedStatus)) {
        return true;
      }

      // Check original partner status for backward compatibility
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

    // Debug logging
    if (statuses.includes('WAITING_FOR_APPROVAL')) {
      console.log('Waiting for Approval bucket debug:', {
        totalJobs: jobs.length,
        waitingApprovalJobs: filteredJobs.length,
        jobsWithApprovalStatus: jobs.filter(j => 
          j.partner_status === 'WAITING_FOR_APPROVAL' || j.partner_status === 'WAITING_FOR_OHME_APPROVAL'
        ).length,
        reviewJobs: jobs.filter(j => isReview(j)).length,
        filteredJobStatuses: filteredJobs.map(j => ({
          id: j.id,
          partner_status: j.partner_status,
          status_enhanced: j.status_enhanced,
          isReview: isReview(j)
        }))
      });
    }

    return filteredJobs;
  };

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts = {
      needs_quotation: getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION').length,
      waiting_approval: getBucketJobs('WAITING_FOR_APPROVAL').length,
      review: getBucketJobs('REVIEW').length,
      needs_scheduling: getBucketJobs('NEEDS_SCHEDULING').length,
      rejected_rework: getBucketJobs('REJECTED', 'REWORK_REQUESTED').length
    };

    console.log('Status counts calculated:', counts);
    console.log('Total jobs:', jobs.length);
    console.log('Jobs by partner status:', {
      WAITING_FOR_APPROVAL: jobs.filter(j => j.partner_status === 'WAITING_FOR_APPROVAL').length,
      WAITING_FOR_OHME_APPROVAL: jobs.filter(j => j.partner_status === 'WAITING_FOR_OHME_APPROVAL').length,
      NEW_JOB: jobs.filter(j => j.partner_status === 'NEW_JOB').length,
      AWAITING_QUOTATION: jobs.filter(j => j.partner_status === 'AWAITING_QUOTATION').length
    });

    return counts;
  }, [jobs]);

  // Active jobs for current status
  const activeJobs = useMemo(() => {
    let jobs_for_status;
    switch (activeStatus) {
      case 'needs_quotation':
        jobs_for_status = getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION');
        break;
      case 'waiting_approval':
        jobs_for_status = getBucketJobs('WAITING_FOR_APPROVAL');
        break;
      case 'review':
        jobs_for_status = getBucketJobs('REVIEW');
        break;
      case 'needs_scheduling':
        jobs_for_status = getBucketJobs('NEEDS_SCHEDULING');
        break;
      case 'rejected_rework':
        jobs_for_status = getBucketJobs('REJECTED', 'REWORK_REQUESTED');
        break;
      default:
        jobs_for_status = getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION');
    }

    console.log(`Active jobs for status "${activeStatus}":`, jobs_for_status.length);
    return jobs_for_status;
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
            <Select value={selectedPartner || ''} onValueChange={(partnerId) => {
              setSelectedPartner(partnerId);
              setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('partnerId', partnerId);
                return newParams;
              });
            }}>
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

            {/* Data truncation warning */}
            {dataTruncated && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Loaded {fetchedCount.toLocaleString()} of {totalCount.toLocaleString()} total jobs. Narrow filters to see all jobs.
                </AlertDescription>
              </Alert>
            )}

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
