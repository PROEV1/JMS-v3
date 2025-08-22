import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get all jobs for the engineer
  const { data: allJobs, isLoading } = useQuery({
    queryKey: ['engineer-all-jobs', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('engineer_id', engineer.id) 
        .order('scheduled_install_date', { ascending: true });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!engineer?.id,
  });

  if (!engineer) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">My Jobs</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">My Jobs</h1>  
          <p className="text-muted-foreground">Loading jobs...</p>
        </div>
      </div>
    );
  }

  // Group jobs by status
  const groupedJobs = {
    scheduled: allJobs?.filter(job => job.status === 'scheduled') || [],
    in_progress: allJobs?.filter(job => job.status === 'in_progress') || [],
    completed: allJobs?.filter(job => job.status === 'completed') || [],
    cancelled: allJobs?.filter(job => job.status === 'cancelled') || []
  };

  const JobCard = ({ job }: { job: Job }) => (
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
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Jobs</h1>
        <p className="text-muted-foreground">All your scheduled and completed jobs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedJobs.scheduled.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedJobs.in_progress.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedJobs.completed.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedJobs.cancelled.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs by Status */}
      <div className="space-y-6">
        {/* Scheduled Jobs */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Scheduled Jobs</h2>
          {groupedJobs.scheduled.length > 0 ? (
            <div className="grid gap-4">
              {groupedJobs.scheduled.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No scheduled jobs.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* In Progress Jobs */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">In Progress</h2>
          {groupedJobs.in_progress.length > 0 ? (
            <div className="grid gap-4">
              {groupedJobs.in_progress.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">  
                <p className="text-muted-foreground">No jobs in progress.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Completed Jobs */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed Jobs</h2>
          {groupedJobs.completed.length > 0 ? (
            <div className="grid gap-4">
              {groupedJobs.completed.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No completed jobs.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cancelled Jobs */}
        {groupedJobs.cancelled.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Cancelled Jobs</h2>
            <div className="grid gap-4">
              {groupedJobs.cancelled.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}