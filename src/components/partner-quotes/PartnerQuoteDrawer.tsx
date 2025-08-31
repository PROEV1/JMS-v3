
import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { AddQuoteModal } from './AddQuoteModal';
import { format } from 'date-fns';

interface PartnerQuoteDrawerProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    address: string;
    job_type: string;
    partner_status: string;
    partner_job_id: string;
    created_at: string;
    latest_quote?: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      submitted_at: string;
      file_url?: string;
      notes?: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteUpdated: () => void;
  partnerName: string;
}

export function PartnerQuoteDrawer({
  job,
  open,
  onOpenChange,
  onQuoteUpdated,
  partnerName
}: PartnerQuoteDrawerProps) {
  const [showAddQuote, setShowAddQuote] = useState(false);

  const handleOpenInPartner = () => {
    if (partnerName.toLowerCase().includes('ohme')) {
      const url = `https://connect.ohme-ev.com/en/jobs/job/${job.partner_job_id}`;
      window.open(url, '_blank');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AWAITING_QUOTATION': return 'bg-orange-100 text-orange-800';
      case 'QUOTE_SUBMITTED': return 'bg-blue-100 text-blue-800';
      case 'QUOTE_APPROVED': return 'bg-green-100 text-green-800';
      case 'QUOTE_REJECTED': return 'bg-red-100 text-red-800';
      case 'QUOTE_REWORK_REQUESTED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canAddQuote = ['AWAITING_QUOTATION', 'QUOTE_REJECTED', 'QUOTE_REWORK_REQUESTED'].includes(job.partner_status);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[600px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>{job.client_name}</SheetTitle>
            <SheetDescription>
              {job.order_number} • Partner Job Details
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Job Overview */}
            <div>
              <h3 className="font-medium mb-3">Job Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Client: </span>
                  <span className="font-medium">{job.client_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Address: </span>
                  {job.address}
                </div>
                <div>
                  <span className="text-muted-foreground">Job Type: </span>
                  {job.job_type}
                </div>
                <div>
                  <span className="text-muted-foreground">Partner Job ID: </span>
                  {job.partner_job_id}
                </div>
                <div>
                  <span className="text-muted-foreground">Imported: </span>
                  {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge className={getStatusColor(job.partner_status)}>
                    {job.partner_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Partner: </span>
                  <Badge variant="outline">{partnerName}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Quote Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Quote Information</h3>
                {canAddQuote && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddQuote(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {job.latest_quote ? 'Update Quote' : 'Add Quote'}
                  </Button>
                )}
              </div>

              {job.latest_quote ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Amount: </span>
                    <span className="font-medium">
                      £{job.latest_quote.amount} {job.latest_quote.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge className={getStatusColor(job.latest_quote.status)}>
                      {job.latest_quote.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted: </span>
                    {format(new Date(job.latest_quote.submitted_at), 'MMM d, yyyy HH:mm')}
                  </div>
                  {job.latest_quote.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes: </span>
                      <div className="mt-1 p-2 bg-muted rounded text-xs">
                        {job.latest_quote.notes}
                      </div>
                    </div>
                  )}
                  {job.latest_quote.file_url && (
                    <div>
                      <span className="text-muted-foreground">File: </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => window.open(job.latest_quote!.file_url, '_blank')}
                      >
                        View Quote File
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
                  No quote submitted yet
                </div>
              )}
            </div>

            <Separator />

            {/* Activity Feed */}
            <div>
              <h3 className="font-medium mb-3">Activity Feed</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span>Job imported from {partnerName}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(job.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                {job.latest_quote && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Quote submitted (£{job.latest_quote.amount})</span>
                    <span className="text-muted-foreground">
                      {format(new Date(job.latest_quote.submitted_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenInPartner}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in {partnerName}
              </Button>

              {canAddQuote && (
                <Button
                  className="w-full"
                  onClick={() => setShowAddQuote(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {job.latest_quote ? 'Update Quote' : 'Add Quote'}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AddQuoteModal
        open={showAddQuote}
        onOpenChange={setShowAddQuote}
        job={job}
        onQuoteAdded={() => {
          onQuoteUpdated();
          setShowAddQuote(false);
        }}
      />
    </>
  );
}
