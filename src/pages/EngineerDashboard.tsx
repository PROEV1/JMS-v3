import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Package, User, Plus, Eye, Play, ArrowRight, FileText, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';  
import { StockRequestButton } from '@/components/engineer/StockRequestButton';
import { useStockRequests } from '@/hooks/useStockRequests';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  order_number: string;
  client_id: string;
  job_address: string;
  scheduled_install_date: string;
  time_window: string;
  status: string;
  job_type?: 'installation' | 'assessment' | 'service_call';
  estimated_duration_hours?: number;
  postcode?: string;
  client?: {
    full_name: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'status-pending';
    case 'in_progress': return 'status-sent';
    case 'completed': return 'status-accepted';
    case 'cancelled': return 'status-rejected';
    default: return 'badge-cream';
  }
};

const getStockRequestStatusColor = (status: string) => {
  switch (status) {
    case 'submitted': 
    case 'pending': return 'status-pending';
    case 'approved': 
    case 'delivered': return 'status-accepted';
    case 'rejected': 
    case 'cancelled': return 'status-rejected';
    case 'in_pick':
    case 'in_transit': return 'status-sent';
    default: return 'badge-cream';
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (timeString: string | null): string => {
  if (!timeString) return 'Time TBA';
  return timeString;
};

export default function EngineerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get engineer profile
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get stock requests count
  const { data: stockRequests } = useStockRequests(engineer?.id, 3);

  // Start job mutation
  const startJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', jobId);
        
      if (error) throw error;
      return jobId;
    },
    onSuccess: (jobId) => {
      queryClient.invalidateQueries({ queryKey: ['todays-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-jobs'] });
      toast({
        title: "Job Started",
        description: "Job status updated to in progress.",
      });
      navigate(`/engineer/jobs/${jobId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start job. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Get today's jobs with client info
  const { data: todaysJobs } = useQuery({
    queryKey: ['todays-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(full_name)
        `)
        .eq('engineer_id', engineer.id)
        .gte('scheduled_install_date', today)
        .lt('scheduled_install_date', tomorrow)
        .order('scheduled_install_date', { ascending: true });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!engineer?.id,
  });

  // Get upcoming jobs (3-5 day horizon)
  const { data: upcomingJobs } = useQuery({
    queryKey: ['upcoming-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(full_name)
        `)
        .eq('engineer_id', engineer.id)
        .gte('scheduled_install_date', tomorrow)
        .lt('scheduled_install_date', fiveDaysFromNow)
        .order('scheduled_install_date', { ascending: true })
        .limit(8);

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!engineer?.id,
  });

  // Get assigned chargers
  const { data: assignedChargers } = useQuery({
    queryKey: ['assigned-chargers', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          *,
          charger_item:inventory_items(name, sku)
        `)
        .eq('engineer_id', engineer.id)
        .eq('status', 'assigned')
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!engineer?.id,
  });

  if (!engineer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back, {engineer.name}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {todaysJobs?.length ? `You have ${todaysJobs.length} job${todaysJobs.length === 1 ? '' : 's'} today` : 'No jobs today - enjoy your day off!'}
          </p>
        </div>
      </div>

      {/* Large Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Jobs Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500 rounded-lg text-white">
                  <Calendar className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Today's Jobs</CardTitle>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {todaysJobs?.length || 0}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">Jobs scheduled for today</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate('/engineer/jobs')}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Jobs Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500 rounded-lg text-white">
                  <Clock className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Upcoming Jobs</CardTitle>
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {upcomingJobs?.length || 0}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-orange-700">Next 5 days</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/engineer/jobs')}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Chargers Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500 rounded-lg text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Assigned Chargers</CardTitle>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {assignedChargers?.length || 0}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-purple-700">Ready for installation</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/engineer/chargers')}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock Requests Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500 rounded-lg text-white">
                  <Package className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Stock Requests</CardTitle>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {stockRequests?.length || 0}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-700">Recent requests</p>
              <StockRequestButton 
                engineerId={engineer.id}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Request
              </StockRequestButton>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Jobs Section */}
      {todaysJobs && todaysJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Today's Schedule
            </h2>
          </div>
          <div className="grid gap-4">
            {todaysJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{job.client?.full_name || 'Unknown Client'}</h3>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                        {job.job_type && (
                          <Badge variant="secondary" className="text-xs">
                            {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1).replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{job.job_address}</span>
                          {job.postcode && <span className="text-xs">({job.postcode})</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(job.time_window)}</span>
                        </div>
                        {job.estimated_duration_hours && (
                          <div className="text-xs bg-muted px-2 py-1 rounded">
                            {job.estimated_duration_hours}h duration
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {job.status === 'scheduled' && (
                        <Button 
                          size="sm"
                          onClick={() => startJobMutation.mutate(job.id)}
                          disabled={startJobMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Job
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/engineer/jobs/${job.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Today's Jobs */}
      {(!todaysJobs || todaysJobs.length === 0) && (
        <Card className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent>
            <Calendar className="h-16 w-16 mx-auto text-blue-300 mb-4" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">No jobs today</h3>
            <p className="text-blue-600 mb-4">Enjoy your day off! Check back tomorrow for new assignments.</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/engineer/jobs')}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              View All Jobs
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Jobs Section */}
      {upcomingJobs && upcomingJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Upcoming Jobs (Next 5 Days)
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/engineer/jobs')}
              className="text-muted-foreground hover:text-foreground"
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {upcomingJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-sm transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{job.client?.full_name || 'Unknown Client'}</h4>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(job.scheduled_install_date)}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          {job.job_address}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => navigate(`/engineer/jobs/${job.id}`)}
                      className="shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stock Requests Preview */}
      {stockRequests && stockRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-green-500" />
              Recent Stock Requests
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/engineer/stock-requests')}
              className="text-muted-foreground hover:text-foreground"
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid gap-3">
            {stockRequests.slice(0, 3).map((request) => (
              <Card key={request.id} className="hover:shadow-sm transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {request.lines?.length || 0} item{request.lines?.length === 1 ? '' : 's'}
                        </h4>
                        <Badge className={getStockRequestStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {request.destination_location?.name} • {formatDate(request.created_at)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {request.priority === 'high' && '🔴'} 
                      {request.priority === 'medium' && '🟡'} 
                      {request.priority === 'low' && '🟢'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Chargers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Assigned Chargers
          </h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/engineer/chargers')}
            className="text-muted-foreground hover:text-foreground"
          >
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        {assignedChargers && assignedChargers.length > 0 ? (
          <div className="grid gap-3">
            {assignedChargers.slice(0, 3).map((charger) => (
              <Card key={charger.id} className="hover:shadow-sm transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{charger.charger_item?.name || 'Unknown Charger'}</h4>
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          {charger.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Serial: {charger.serial_number}</span>
                        <span>SKU: {charger.charger_item?.sku}</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => navigate('/engineer/chargers')}
                      className="shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-8 bg-gradient-to-br from-purple-50 to-indigo-50">
            <CardContent>
              <Zap className="h-12 w-12 mx-auto text-purple-300 mb-3" />
              <h3 className="text-sm font-medium text-purple-900 mb-1">No chargers assigned</h3>
              <p className="text-xs text-purple-600 mb-3">You don't have any chargers assigned at the moment.</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/engineer/chargers')}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                View Chargers Page
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
