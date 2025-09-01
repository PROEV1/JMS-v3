
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
  Eye, 
  Calendar,
  MapPin,
  User,
  PoundSterling,
  Quote,
  Undo2
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
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
  quote_override?: {
    id: string;
    override_type: 'quoted_pending_approval' | 'standard_quote_marked';
    notes?: string;
    created_at: string;
  };
  status_enhanced?: string;
}

interface PartnerQuoteListProps {
  jobs: PartnerQuoteJob[];
  onJobClick: (job: PartnerQuoteJob) => void;
  onMarkAsQuoted: (job: PartnerQuoteJob, quoteType: 'custom' | 'standard') => void;
  onClearOverride: (job: PartnerQuoteJob) => void;
  onOpenInPartner: (job: PartnerQuoteJob) => void;
  loading?: boolean;
  readOnly?: boolean;
}

function QuoteJobMobileCard({ 
  job, 
  onJobClick, 
  onMarkAsQuoted, 
  onClearOverride, 
  onOpenInPartner,
  readOnly 
}: { 
  job: PartnerQuoteJob;
  onJobClick: (job: PartnerQuoteJob) => void;
  onMarkAsQuoted: (job: PartnerQuoteJob, quoteType: 'custom' | 'standard') => void;
  onClearOverride: (job: PartnerQuoteJob) => void;
  onOpenInPartner: (job: PartnerQuoteJob) => void;
  readOnly?: boolean;
}) {
  const getStatusBadge = (status: string, override?: any) => {
    // Show override status if present
    if (override) {
      if (override.override_type === 'quoted_pending_approval') {
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Custom Quote (Manual)</Badge>;
      }
      if (override.override_type === 'standard_quote_marked') {
        return <Badge variant="outline" className="text-green-600 bg-green-50">Standard Quote (Manual)</Badge>;
      }
    }

    switch (status) {
      case 'NEW_JOB':
      case 'AWAITING_QUOTATION':
        return <Badge variant="outline" className="text-orange-600 bg-orange-50">Needs Quotation</Badge>;
      case 'WAITING_FOR_APPROVAL':
      case 'WAITING_FOR_OHME_APPROVAL':
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Waiting Approval</Badge>;
      case 'AWAITING_INSTALL_DATE':
      case 'INSTALL_DATE_CONFIRMED':
        return <Badge variant="outline" className="text-green-600 bg-green-50">Needs Scheduling</Badge>;
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
              {getStatusBadge(job.partner_status, job.quote_override)}
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
              <DropdownMenuItem onClick={() => onOpenInPartner(job)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Partner System
              </DropdownMenuItem>
              
              {!readOnly && (
                <>
                  <DropdownMenuSeparator />
                  
                  {job.quote_override ? (
                    <DropdownMenuItem onClick={() => onClearOverride(job)}>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Clear Override
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Quote className="h-4 w-4 mr-2" />
                        Mark as Quoted
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => onMarkAsQuoted(job, 'custom')}>
                          Custom Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkAsQuoted(job, 'standard')}>
                          Standard Quote
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </>
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
  onMarkAsQuoted, 
  onClearOverride, 
  onOpenInPartner, 
  loading = false,
  readOnly = false
}: PartnerQuoteListProps) {
  const getStatusBadge = (status: string, override?: any) => {
    // Show override status if present
    if (override) {
      if (override.override_type === 'quoted_pending_approval') {
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Custom Quote (Manual)</Badge>;
      }
      if (override.override_type === 'standard_quote_marked') {
        return <Badge variant="outline" className="text-green-600 bg-green-50">Standard Quote (Manual)</Badge>;
      }
    }

    switch (status) {
      case 'NEW_JOB':
      case 'AWAITING_QUOTATION':
        return <Badge variant="outline" className="text-orange-600 bg-orange-50">Needs Quotation</Badge>;
      case 'WAITING_FOR_APPROVAL':
      case 'WAITING_FOR_OHME_APPROVAL':
        return <Badge variant="outline" className="text-blue-600 bg-blue-50">Waiting Approval</Badge>;
      case 'AWAITING_INSTALL_DATE':
      case 'INSTALL_DATE_CONFIRMED':
        return <Badge variant="outline" className="text-green-600 bg-green-50">Needs Scheduling</Badge>;
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
                    {getStatusBadge(job.partner_status, job.quote_override)}
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
                        <DropdownMenuItem onClick={() => onOpenInPartner(job)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in Partner System
                        </DropdownMenuItem>
                        
                        {!readOnly && (
                          <>
                            <DropdownMenuSeparator />
                            
                            {job.quote_override ? (
                              <DropdownMenuItem onClick={() => onClearOverride(job)}>
                                <Undo2 className="h-4 w-4 mr-2" />
                                Clear Override
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Quote className="h-4 w-4 mr-2" />
                                  Mark as Quoted
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => onMarkAsQuoted(job, 'custom')}>
                                    Custom Quote
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onMarkAsQuoted(job, 'standard')}>
                                    Standard Quote
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}
                          </>
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
            onMarkAsQuoted={onMarkAsQuoted}
            onClearOverride={onClearOverride}
            onOpenInPartner={onOpenInPartner}
            readOnly={readOnly}
          />
        ))}
      </div>
    </>
  );
}
