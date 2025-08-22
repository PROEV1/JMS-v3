import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Package, User, Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';  
import { StockRequestButton } from '@/components/engineer/StockRequestButton';
import { StockRequestHistory } from '@/components/engineer/StockRequestHistory';
import { useStockRequests } from '@/hooks/useStockRequests';

interface Job {
  id: string;
  order_number: string;
  client_id: string;
  job_address: string;
  scheduled_install_date: string;
  time_window: string;
  status: string;
  job_type?: 'installation' | 'assessment' | 'service_call';
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (timeString: string): string => {
  const date = new Date(`1970-01-01T${timeString}`);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function EngineerDashboard() {
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
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get stock requests count
  const { data: stockRequests } = useStockRequests(engineer?.id);


  // Get today's jobs
  const { data: todaysJobs } = useQuery({
    queryKey: ['todays-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('engineer_id', engineer.id)
        .gte('scheduled_install_date', today)
        .lt('scheduled_install_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(5);

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!engineer?.id,
  });

  // Get upcoming jobs
  const { data: upcomingJobs } = useQuery({
    queryKey: ['upcoming-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('engineer_id', engineer.id)
        .gte('scheduled_install_date', tomorrow)
        .order('scheduled_install_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!engineer?.id,
  });

  if (!engineer) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Engineer Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {engineer.name}</h1>
          <p className="text-muted-foreground">Here's what's happening today</p>
        </div>
        <div className="flex gap-2">
          <StockRequestButton 
            engineerId={engineer.id}
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Stock Request
          </StockRequestButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today's Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysJobs?.length || 0}</div>
            <p className="text-muted-foreground">Jobs scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingJobs?.length || 0}</div>
            <p className="text-muted-foreground">Jobs in the next few days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockRequests?.length || 0}</div>
            <p className="text-muted-foreground">Stock requests</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedule">Today's Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Jobs</TabsTrigger>
          <TabsTrigger value="stock">Stock Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <h2 className="text-xl font-semibold">Today's Schedule</h2>
          {todaysJobs && todaysJobs.length > 0 ? (
            <div className="space-y-4">
              {todaysJobs.map((job) => (
                 <Card key={job.id}>
                   <CardHeader>
                     <div className="flex items-center gap-2 flex-wrap">
                       <CardTitle>{job.order_number}</CardTitle>
                       {job.job_type && (
                         <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                           {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1).replace('_', ' ')}
                         </Badge>
                       )}
                     </div>
                   </CardHeader>
                   <CardContent className="space-y-2">
                     <div className="flex items-center gap-2">
                       <MapPin className="h-4 w-4" />
                       <span>{job.job_address}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Calendar className="h-4 w-4" />
                       <span>{formatDate(job.scheduled_install_date)}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Clock className="h-4 w-4" />
                       <span>{formatTime(job.time_window)}</span>
                     </div>
                     <div className="flex items-center justify-between mt-3">
                       <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                       <Button 
                         size="sm" 
                         onClick={() => navigate(`/engineer/jobs/${job.id}`)}
                         className="ml-auto"
                       >
                         <Eye className="h-4 w-4 mr-1" />
                         View Details
                       </Button>
                     </div>
                   </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">No jobs scheduled for today.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <h2 className="text-xl font-semibold">Upcoming Jobs</h2>
          {upcomingJobs && upcomingJobs.length > 0 ? (
            <div className="space-y-4">
              {upcomingJobs.map((job) => (
                 <Card key={job.id}>
                   <CardHeader>
                     <div className="flex items-center gap-2 flex-wrap">
                       <CardTitle>{job.order_number}</CardTitle>
                       {job.job_type && (
                         <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                           {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1).replace('_', ' ')}
                         </Badge>
                       )}
                     </div>
                   </CardHeader>
                   <CardContent className="space-y-2">
                     <div className="flex items-center gap-2">
                       <MapPin className="h-4 w-4" />
                       <span>{job.job_address}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Calendar className="h-4 w-4" />
                       <span>{formatDate(job.scheduled_install_date)}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Clock className="h-4 w-4" />
                       <span>{formatTime(job.time_window)}</span>
                     </div>
                     <div className="flex items-center justify-between mt-3">
                       <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                       <Button 
                         size="sm" 
                         onClick={() => navigate(`/engineer/jobs/${job.id}`)}
                         className="ml-auto"
                       >
                         <Eye className="h-4 w-4 mr-1" />
                         View Details
                       </Button>
                     </div>
                   </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">No upcoming jobs scheduled.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Stock Requests</h2>
            <StockRequestButton engineerId={engineer.id} />
          </div>
          <StockRequestHistory engineerId={engineer.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
