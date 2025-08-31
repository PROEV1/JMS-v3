import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddQuoteModal } from './AddQuoteModal';
import { ExternalLink, FileText, Calendar, MapPin, Phone, Mail, Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface PartnerQuoteDrawerProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    address: string;
    job_type: 'installation' | 'assessment' | 'service_call';
    partner_status: string;
    partner_job_id: string;
    partner_external_id: string;
    created_at: string;
    partner_id: string;
    postcode: string;
    total_amount: number;
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
    sla_hours?: number;
    require_file?: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteUpdated: () => void;
  partnerName: string;
}

export function PartnerQuoteDrawer({ job, open, onOpenChange, onQuoteUpdated, partnerName }: PartnerQuoteDrawerProps) {
  const [addQuoteOpen, setAddQuoteOpen] = useState(false);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'AWAITING_QUOTATION': return 'Awaiting Quotation';
      case 'QUOTE_SUBMITTED': return 'Quote Submitted';
      case 'QUOTE_APPROVED': return 'Quote Approved';
      case 'QUOTE_REJECTED': return 'Quote Rejected';
      case 'QUOTE_REWORK_REQUESTED': return 'Rework Required';
      default: return status;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Job Details</SheetTitle>
            <SheetDescription>{job.order_number} • {partnerName}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>{job.client_name}</div>
                  <div className="text-sm text-muted-foreground">{job.address}</div>
                  <div className="text-sm">Job Type: {job.job_type}</div>
                  <div className="text-sm">Value: £{job.total_amount}</div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => setAddQuoteOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Quote
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AddQuoteModal
        job={job}
        open={addQuoteOpen}
        onOpenChange={setAddQuoteOpen}
        onQuoteAdded={onQuoteUpdated}
        partnerName={partnerName}
      />
    </>
  );
}