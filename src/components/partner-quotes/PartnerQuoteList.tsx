import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  MoreHorizontal, 
  ExternalLink, 
  Plus, 
  Eye, 
  Calendar,
  MapPin,
  User,
  PoundSterling
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { PartnerJobBadge } from '@/components/admin/PartnerJobBadge';
import { format } from 'date-fns';

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
}

interface PartnerQuoteListProps {
  jobs: PartnerQuoteJob[];
  onJobClick: (job: PartnerQuoteJob) => void;
  onAddQuote: (job: PartnerQuoteJob) => void;
  onOpenInPartner: (url: string) => void;
  loading?: boolean;
}

function QuoteJobMobileCard({ 
  job, 
  onJobClick, 
  onAddQuote, 
  onOpenInPartner 
}: { 
  job: PartnerQuoteJob;
  onJobClick: (job: PartnerQuoteJob) => void;
  onAddQuote: (job: PartnerQuoteJob) => void;
  onOpenInPartner: (url: string) => void;
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW_JOB':
        return <Badge variant="outline" className="text-orange-600 bg-orange-50">Needs Quotation</Badge>;
      case 'WAITING_FOR_APPROVAL':
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Waiting Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="text-green-600 bg-green-50">Approved</Badge>;
      case 'REWORK_REQUESTED':
        return <Badge variant="outline" className="text-red-600 bg-red-50">Rework</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="text-red-600 bg-red-50">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm">{job.order_number}</h3>
              {getStatusBadge(job.partner_status)}
            </div>
            <p className="text-sm text-muted-foreground">{job.client.full_name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {job.client.postcode || job.postcode}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onJobClick(job)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddQuote(job)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Quote
              </DropdownMenuItem>
              {job.partner_external_url && (
                <DropdownMenuItem onClick={() => onOpenInPartner(job.partner_external_url!)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Partner
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(job.created_at), 'dd/MM/yyyy')}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {job.partner.name}
          </div>
          {job.total_amount && (
            <div className="flex items-center gap-1">
              <PoundSterling className="h-3 w-3" />
              £{job.total_amount.toFixed(2)}
            </div>
          )}
          {job.job_type && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                {job.job_type.replace('_', ' ')}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PartnerQuoteList({ 
  jobs, 
  onJobClick, 
  onAddQuote, 
  onOpenInPartner, 
  loading = false 
}: PartnerQuoteListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW_JOB':
        return <Badge variant="outline" className="text-orange-600 bg-orange-50">Needs Quotation</Badge>;
      case 'WAITING_FOR_APPROVAL':
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Waiting Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="text-green-600 bg-green-50">Approved</Badge>;
      case 'REWORK_REQUESTED':
        return <Badge variant="outline" className="text-red-600 bg-red-50">Rework</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="text-red-600 bg-red-50">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No jobs found for the current filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Job Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow 
                  key={job.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onJobClick(job)}
                >
                  <TableCell className="font-medium">
                    {job.order_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{job.client.full_name}</p>
                      <p className="text-xs text-muted-foreground">{job.client.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {job.client.postcode || job.postcode || '-'}
                  </TableCell>
                  <TableCell>
                    {job.partner.name}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(job.partner_status)}
                  </TableCell>
                  <TableCell>
                    {job.job_type ? (
                      <Badge variant="secondary" className="text-xs">
                        {job.job_type.replace('_', ' ')}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(job.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {job.total_amount ? `£${job.total_amount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onJobClick(job)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAddQuote(job)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Quote
                        </DropdownMenuItem>
                        {job.partner_external_url && (
                          <DropdownMenuItem onClick={() => onOpenInPartner(job.partner_external_url!)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in Partner
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {jobs.map((job) => (
          <QuoteJobMobileCard
            key={job.id}
            job={job}
            onJobClick={onJobClick}
            onAddQuote={onAddQuote}
            onOpenInPartner={onOpenInPartner}
          />
        ))}
      </div>
    </>
  );
}