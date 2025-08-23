import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface PartnerUser {
  id: string;
  partner_id: string;
  role: string;
}

interface PartnerJobsListProps {
  partnerUser: PartnerUser;
}

export function PartnerJobsList({ partnerUser }: PartnerJobsListProps) {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['partner-jobs', partnerUser.partner_id],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(
            full_name,
            email,
            phone
          )
        `)
        .eq('is_partner_job', true)
        .order('created_at', { ascending: false });

      // Apply partner-specific filtering
      if (partnerUser.role === 'partner_dealer') {
        query = query.eq('partner_id', partnerUser.partner_id);
      } else if (partnerUser.role === 'partner_manufacturer') {
        // Manufacturers can see their own jobs and jobs from dealers under them
        const { data: childPartners } = await supabase
          .from('partners')
          .select('id')
          .eq('parent_partner_id', partnerUser.partner_id);
        
        const partnerIds = [partnerUser.partner_id, ...(childPartners?.map(p => p.id) || [])];
        query = query.in('partner_id', partnerIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'scheduled':
        return 'secondary';
      case 'in_progress':
        return 'destructive';
      case 'awaiting_payment':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Loading your jobs...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Jobs</CardTitle>
        <CardDescription>
          {jobs?.length || 0} total jobs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No jobs found. Upload your first job to get started.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-sm">
                      {job.order_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{job.client?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{job.client?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {job.job_address}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatStatus(job.job_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(job.status_enhanced || job.status)}>
                        {formatStatus(job.status_enhanced || job.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(job.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {job.scheduled_install_date 
                        ? format(new Date(job.scheduled_install_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}