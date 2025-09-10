import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Eye, 
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Hourglass,
  XCircle,
  ClipboardList,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';

interface Job {
  id: string;
  order_number: string;
  client_id: string;
  client: {
    full_name: string;
    email: string;
    phone: string;
    address: string;
    postcode: string;
  } | null;
  job_address: string;
  postcode: string;
  scheduled_install_date: string | null;
  time_window: string | null;
  status: string;
  status_enhanced: string;
  job_type: 'installation' | 'assessment' | 'service_call';
  estimated_duration_hours: number | null;
  engineer_signed_off_at: string | null;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_progress': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'install_completed_pending_qa': return 'bg-green-100 text-green-800 border-green-200';
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'scheduled': return Calendar;
    case 'in_progress': return Hourglass;
    case 'install_completed_pending_qa': return CheckCircle;
    case 'completed': return CheckCircle;
    case 'cancelled': return XCircle;
    default: return AlertCircle;
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Not scheduled';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatTime = (timeString: string | null): string => {
  if (!timeString) return 'Time TBA';
  return timeString;
};

const formatDuration = (hours: number | null): string => {
  if (!hours) return 'Duration TBA';
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
};

export default function EngineerJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get engineer profile
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get all jobs for the engineer with client information
  const { data: allJobs, isLoading } = useQuery({
    queryKey: ['engineer-all-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          client_id,
          job_address,
          postcode,
          scheduled_install_date,
          time_window,
          status,
          status_enhanced,
          job_type,
          estimated_duration_hours,
          engineer_signed_off_at,
          created_at
        `)
        .eq('engineer_id', engineer.id)
        .order('scheduled_install_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Fetch client information for each order
      const jobsWithClients = await Promise.all(
        (orderData || []).map(async (order) => {
          if (!order.client_id) {
            return { ...order, client: null };
          }

          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('full_name, email, phone, address, postcode')
            .eq('id', order.client_id)
            .maybeSingle();

          if (clientError) {
            console.error('Error fetching client:', clientError);
            return { ...order, client: null };
          }

          return { ...order, client: clientData };
        })
      );

      return jobsWithClients as Job[];
    },
    enabled: !!engineer?.id,
  });

  if (!engineer) {
    return <BrandLoading />;
  }

  if (isLoading) {
    return <BrandLoading />;
  }

  // Group jobs by enhanced status
  const groupedJobs = {
    scheduled: allJobs?.filter(job => 
      job.status_enhanced === 'scheduled' || 
      (job.scheduled_install_date && !job.engineer_signed_off_at)
    ) || [],
    in_progress: allJobs?.filter(job => job.status_enhanced === 'in_progress') || [],
    completed: allJobs?.filter(job => 
      job.status_enhanced === 'completed' || 
      job.status_enhanced === 'install_completed_pending_qa'
    ) || [],
    cancelled: allJobs?.filter(job => job.status_enhanced === 'cancelled') || []
  };

  const JobCard = ({ job }: { job: Job }) => {
    const StatusIcon = getStatusIcon(job.status_enhanced);
    const fullAddress = job.job_address && job.postcode 
      ? `${job.job_address}, ${job.postcode}`
      : job.job_address || job.client?.address || 'Address not available';

    return (
      <Card className="hover:shadow-md transition-shadow duration-200 animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{job.order_number}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {job.client?.full_name || 'Client not available'} 
                </p>
              </div>
            </div>
            <Badge variant="outline" className={getStatusColor(job.status_enhanced)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {job.status_enhanced.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{fullAddress}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(job.scheduled_install_date)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(job.time_window)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span>{formatDuration(job.estimated_duration_hours)}</span>
            </div>
          </div>

          {job.client && (job.client.phone || job.client.email) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
              {job.client.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{job.client.phone}</span>
                </div>
              )}
              {job.client.email && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{job.client.email}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button 
              size="sm" 
              onClick={() => navigate(`/engineer/jobs/${job.id}`)}
              className="bg-primary hover:bg-primary/90"
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const StatusCard = ({ 
    title, 
    count, 
    icon: Icon, 
    color, 
    gradient 
  }: { 
    title: string; 
    count: number; 
    icon: any; 
    color: string; 
    gradient: string; 
  }) => (
    <Card className={`${gradient} border-0 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-3xl font-bold text-white">{count}</p>
          </div>
          <div className={`p-3 rounded-full ${color} bg-white/20`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ 
    title, 
    message, 
    icon: Icon 
  }: { 
    title: string; 
    message: string; 
    icon: any; 
  }) => (
    <Card className="animate-fade-in">
      <CardContent className="p-8 text-center">
        <div className="p-4 rounded-full bg-muted/20 w-fit mx-auto mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-8">
          {/* Header */}
          <div className="animate-fade-in">
            <BrandHeading1>My Jobs</BrandHeading1>
            <p className="text-muted-foreground text-lg">
              All your scheduled and completed jobs
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Scheduled"
              count={groupedJobs.scheduled.length}
              icon={Calendar}
              color="text-blue-600"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatusCard
              title="In Progress"
              count={groupedJobs.in_progress.length}
              icon={Hourglass}
              color="text-orange-600"
              gradient="bg-gradient-to-br from-orange-500 to-orange-600"
            />
            <StatusCard
              title="Completed"
              count={groupedJobs.completed.length}
              icon={CheckCircle}
              color="text-green-600"
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
            <StatusCard
              title="Cancelled"
              count={groupedJobs.cancelled.length}
              icon={XCircle}
              color="text-red-600"
              gradient="bg-gradient-to-br from-gray-500 to-gray-600"
            />
          </div>

          {/* Jobs by Status */}
          <div className="space-y-8">
            {/* Scheduled Jobs */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600" />
                Scheduled Jobs
              </h2>
              {groupedJobs.scheduled.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupedJobs.scheduled.map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No scheduled jobs"
                  message="All your upcoming scheduled jobs will appear here."
                  icon={Calendar}
                />
              )}
            </div>

            {/* In Progress Jobs */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Hourglass className="h-6 w-6 text-orange-600" />
                In Progress
              </h2>
              {groupedJobs.in_progress.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupedJobs.in_progress.map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No jobs in progress"
                  message="Active installations you're working on will show here."
                  icon={Hourglass}
                />
              )}
            </div>

            {/* Completed Jobs */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Completed Jobs
              </h2>
              {groupedJobs.completed.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupedJobs.completed.slice(0, 10).map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No completed jobs"
                  message="Your finished installations will be listed here."
                  icon={CheckCircle}
                />
              )}
              {groupedJobs.completed.length > 10 && (
                <div className="text-center">
                  <Button variant="outline">
                    View All Completed Jobs ({groupedJobs.completed.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Cancelled Jobs */}
            {groupedJobs.cancelled.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-red-600" />
                  Cancelled Jobs
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupedJobs.cancelled.map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}