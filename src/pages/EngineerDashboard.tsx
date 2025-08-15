import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { JobStatusCard } from '@/components/engineer/JobStatusCard';
import { OrderStatusEnhanced } from '@/components/admin/EnhancedJobStatusBadge';
import { isToday, isThisWeek, isWithinLastDays } from '@/utils/dateUtils';
import { Calendar, MapPin, Package, User, AlertTriangle, Clock, CheckCircle, Upload } from 'lucide-react';

interface EngineerJob {
  id: string;
  order_number: string;
  client_name: string;
  job_address: string;
  scheduled_install_date: string | null;
  status_enhanced: OrderStatusEnhanced;
  engineer_status: string | null;
  product_details: string;
  client_phone: string;
  total_amount: number;
  engineer_signed_off_at: string | null;
  upload_count?: number;
}

export default function EngineerDashboard() {
  const [jobs, setJobs] = useState<EngineerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineerInfo, setEngineerInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // COMPLETELY NEW APPROACH - Direct fetch without complex conditions
  useEffect(() => {
    console.log('🔥 DIRECT FETCH: Component mounted or user changed');
    if (user?.id) {
      console.log('🔥 DIRECT FETCH: User ID exists, executing immediate fetch');
      directFetchEngineerJobs();
    }
  }, [user]);

  // Simple, direct data fetching function
  const directFetchEngineerJobs = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Step 1: Get engineer ID first
      const { data: engineer, error: engineerError } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (engineerError || !engineer) {
        setErrorMessage('Engineer profile not found');
        return;
      }

      setEngineerInfo(engineer);

      // Step 2: Get jobs for this engineer with upload counts
      const { data: jobs, error: jobsError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status_enhanced,
          engineer_status,
          job_address,
          scheduled_install_date,
          total_amount,
          engineer_signed_off_at,
          quote_id,
          client_id,
          clients (
            full_name,
            phone
          ),
          quotes (
            product_details
          )
        `)
        .eq('engineer_id', engineer.id);

      // Get upload counts for each job
      let uploadCounts: Record<string, number> = {};
      if (jobs && jobs.length > 0) {
        const { data: uploads } = await supabase
          .from('engineer_uploads')
          .select('order_id')
          .in('order_id', jobs.map(j => j.id));
        
        if (uploads) {
          uploadCounts = uploads.reduce((acc, upload) => {
            acc[upload.order_id] = (acc[upload.order_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      if (jobsError) {
        setErrorMessage(`Jobs query error: ${jobsError.message}`);
        return;
      }

      if (!jobs || jobs.length === 0) {
        setJobs([]);
        return;
      }

      // Step 3: Format jobs with upload counts
      const formattedJobs = jobs.map(job => ({
        id: job.id,
        order_number: job.order_number,
        client_name: job.clients?.full_name || 'Unknown Client',
        client_phone: job.clients?.phone || 'No phone',
        job_address: job.job_address || 'Address not specified',
        scheduled_install_date: job.scheduled_install_date,
        status_enhanced: job.status_enhanced,
        engineer_status: job.engineer_status,
        product_details: job.quotes?.product_details || 'No product details',
        total_amount: job.total_amount,
        engineer_signed_off_at: job.engineer_signed_off_at,
        upload_count: uploadCounts[job.id] || 0
      }));

      setJobs(formattedJobs);

    } catch (error: any) {
      setErrorMessage(`Unexpected error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEngineerData = async () => {
    try {
      console.log('🚀 FORCE STARTING engineer data fetch for user:', user?.id);
      console.log('🚀 User email:', user?.email);
      console.log('🚀 Auth loading state:', authLoading);
      console.log('🚀 Current timestamp:', new Date().toISOString());
      
      // Force loading state and clear previous state
      setLoading(true);
      setErrorMessage(null);
      setJobs([]);
      setEngineerInfo(null);
      console.log('🚀 Set loading=true, cleared all previous state');

      // Step 1: Get engineer info - force fresh query
      console.log('📋 Step 1: FORCE Fetching engineer info for user_id:', user?.id);
      const { data: engineer, error: engineerError } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      console.log('🔍 Engineer query result:', { engineer, engineerError });

      if (engineerError) {
        console.error('❌ Engineer query error:', engineerError);
        throw new Error(`Engineer lookup failed: ${engineerError.message}`);
      }

      if (!engineer) {
        console.error('❌ No engineer record found for user:', user?.id);
        console.log('📋 Available engineers check - querying all engineers...');
        const { data: allEngineers } = await supabase.from('engineers').select('*');
        console.log('📋 All engineers in system:', allEngineers);
        throw new Error('No engineer profile found for your account. Please contact admin.');
      }

      console.log('✅ Engineer found:', engineer);
      setEngineerInfo(engineer);

      // Step 2: Get jobs for this engineer - force fresh query
      console.log('📋 Step 2: Fetching jobs for engineer ID:', engineer.id);
      console.log('📋 Step 2: Engineer name:', engineer.name);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status_enhanced,
          job_address,
          scheduled_install_date,
          total_amount,
          engineer_signed_off_at,
          quote_id,
          client_id
        `)
        .eq('engineer_id', engineer.id)
        .order('scheduled_install_date', { ascending: true });

      console.log('🔍 Orders query result:', { orders, ordersError, count: orders?.length });

      if (ordersError) {
        console.error('❌ Orders query error:', ordersError);
        throw new Error(`Failed to load jobs: ${ordersError.message}`);
      }

      console.log('✅ Raw orders found:', orders?.length || 0);
      if (orders && orders.length > 0) {
        console.log('✅ First order sample:', orders[0]);
      }

      if (!orders || orders.length === 0) {
        console.log('ℹ️ No orders found for engineer ID:', engineer.id);
        console.log('📋 DEBUG: Checking all orders in system...');
        const { data: allOrders } = await supabase.from('orders').select('id, order_number, engineer_id');
        console.log('📋 All orders in system:', allOrders);
        setJobs([]);
        toast({
          title: "No Jobs Found",
          description: "You don't have any assigned jobs at the moment.",
        });
        return;
      }

      // Step 3: Get related data
      console.log('📋 Step 3: Fetching quotes and clients for', orders.length, 'orders');
      const quoteIds = orders.map(order => order.quote_id);
      const clientIds = orders.map(order => order.client_id);

      const [quotesResult, clientsResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('id, product_details')
          .in('id', quoteIds),
        supabase
          .from('clients')
          .select('id, full_name, phone')
          .in('id', clientIds)
      ]);

      if (quotesResult.error) {
        console.error('❌ Quotes query error:', quotesResult.error);
        throw new Error(`Failed to load quote details: ${quotesResult.error.message}`);
      }

      if (clientsResult.error) {
        console.error('❌ Clients query error:', clientsResult.error);
        throw new Error(`Failed to load client details: ${clientsResult.error.message}`);
      }

      console.log('✅ Quotes:', quotesResult.data);
      console.log('✅ Clients:', clientsResult.data);

      // This function is kept for backward compatibility but not used
      toast({
        title: "Jobs Loaded Successfully", 
        description: "Dashboard refreshed",
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred');
      toast({
        title: "Error Loading Dashboard",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Force refresh function
  const forceRefresh = () => {
    console.log('🔄 FORCE REFRESH: Manual refresh triggered');
    setJobs([]);
    setEngineerInfo(null);
    setErrorMessage(null);
    directFetchEngineerJobs();
  };

  // Filter jobs based on active tab
  const getFilteredJobs = () => {
    switch (activeTab) {
      case 'today':
        return jobs.filter(job => isToday(job.scheduled_install_date));
      case 'week':
        return jobs.filter(job => isThisWeek(job.scheduled_install_date));
      case 'all':
      default:
        return jobs;
    }
  };

  // Calculate dashboard stats
  const todaysJobs = jobs.filter(job => isToday(job.scheduled_install_date));
  const thisWeekJobs = jobs.filter(job => isThisWeek(job.scheduled_install_date));
  const completedLast7Days = jobs.filter(job => 
    job.engineer_signed_off_at && isWithinLastDays(job.engineer_signed_off_at, 7)
  );
  const jobsAwaitingUpload = jobs.filter(job => 
    job.engineer_signed_off_at && (job.upload_count || 0) === 0
  );

  // Handle job actions
  const handleJobAction = (jobId: string, action: 'start' | 'continue' | 'upload' | 'view') => {
    navigate(`/engineer/job/${jobId}`);
  };

  const filteredJobs = getFilteredJobs();

  if (loading) return <BrandLoading />;

  if (errorMessage) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="text-center py-12">
            <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md mx-auto">
              <h2 className="text-lg font-semibold mb-2">Unable to Load Dashboard</h2>
              <p className="text-sm mb-4">{errorMessage}</p>
              <div className="space-x-2">
                <Button onClick={forceRefresh} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <BrandHeading1>Field Dashboard</BrandHeading1>
              {engineerInfo && (
                <p className="text-muted-foreground mt-2">
                  Welcome back, {engineerInfo.name}
                  {engineerInfo.region && ` • ${engineerInfo.region}`}
                </p>
              )}
            </div>
            <Button onClick={forceRefresh} variant="outline" size="sm">
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Alert for incomplete jobs */}
        {todaysJobs.filter(job => !job.engineer_signed_off_at).length > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {todaysJobs.filter(job => !job.engineer_signed_off_at).length} job{todaysJobs.filter(job => !job.engineer_signed_off_at).length === 1 ? '' : 's'} today still not marked complete
            </AlertDescription>
          </Alert>
        )}

        {/* Upload reminder alert */}
        {jobsAwaitingUpload.length > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <Upload className="h-4 w-4" />
            <AlertDescription>
              {jobsAwaitingUpload.length} completed job{jobsAwaitingUpload.length === 1 ? '' : 's'} need{jobsAwaitingUpload.length === 1 ? 's' : ''} installation photos uploaded
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className={todaysJobs.length === 0 ? "border-blue-200 bg-blue-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Today's Jobs</p>
                  <p className="text-2xl font-bold">
                    {todaysJobs.length}
                    {todaysJobs.length === 0 && <span className="text-sm text-blue-600 ml-2">No jobs today</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">{thisWeekJobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed (7d)</p>
                  <p className="text-2xl font-bold">{completedLast7Days.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={jobsAwaitingUpload.length > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Upload</p>
                  <p className="text-2xl font-bold">{jobsAwaitingUpload.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Your Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today" className="flex items-center gap-2">
                  Today ({todaysJobs.length})
                </TabsTrigger>
                <TabsTrigger value="week" className="flex items-center gap-2">
                  This Week ({thisWeekJobs.length})
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-2">
                  All Jobs ({jobs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="today" className="mt-4">
                {todaysJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs scheduled for today</p>
                    <p className="text-sm">Enjoy your day off!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todaysJobs.map(job => (
                      <JobStatusCard
                        key={job.id}
                        job={job}
                        onActionClick={handleJobAction}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="week" className="mt-4">
                {thisWeekJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs scheduled for this week</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {thisWeekJobs.map(job => (
                      <JobStatusCard
                        key={job.id}
                        job={job}
                        onActionClick={handleJobAction}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="all" className="mt-4">
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs assigned to you yet</p>
                    <p className="text-sm">Check back later for new assignments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.map(job => (
                      <JobStatusCard
                        key={job.id}
                        job={job}
                        onActionClick={handleJobAction}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </BrandContainer>
    </BrandPage>
  );
}