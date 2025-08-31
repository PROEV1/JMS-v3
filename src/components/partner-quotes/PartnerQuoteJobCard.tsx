
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Plus, Clock } from 'lucide-react';
import { format, isAfter, subHours } from 'date-fns';

interface PartnerQuoteJobCardProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    address: string;
    job_type: string;
    partner_status: string;
    created_at: string;
    external_job_id: string;
    latest_quote?: {
      amount: number;
      currency: string;
      status: string;
    };
  };
  onCardClick: () => void;
  onAddQuote?: () => void;
  onOpenInPartner: () => void;
  partnerName: string;
  readOnly?: boolean;
}

export function PartnerQuoteJobCard({
  job,
  onCardClick,
  onAddQuote,
  onOpenInPartner,
  partnerName,
  readOnly = false
}: PartnerQuoteJobCardProps) {
  
  const isSLABreached = () => {
    const importDate = new Date(job.created_at);
    const slaThreshold = subHours(new Date(), 48); // 48 hour SLA
    return isAfter(importDate, slaThreshold) && job.partner_status === 'AWAITING_QUOTATION';
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

  const truncateAddress = (address: string, maxLength = 35) => {
    return address.length > maxLength 
      ? address.substring(0, maxLength) + '...'
      : address;
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-3">
        {/* Header with SLA badge */}
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={onCardClick}>
            <div className="font-medium text-sm mb-1">{job.client_name}</div>
            <div className="text-xs text-muted-foreground mb-1">
              {job.order_number}
            </div>
            <div className="text-xs text-muted-foreground">
              {truncateAddress(job.address)}
            </div>
          </div>
          {isSLABreached() && (
            <Badge variant="destructive" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              SLA
            </Badge>
          )}
        </div>

        {/* Job details */}
        <div className="space-y-2" onClick={onCardClick}>
          <div className="text-xs">
            <span className="text-muted-foreground">Job: </span>
            {job.job_type}
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Import: </span>
            {format(new Date(job.created_at), 'MMM d, HH:mm')}
          </div>
          {job.latest_quote && (
            <div className="text-xs">
              <span className="text-muted-foreground">Quote: </span>
              £{job.latest_quote.amount} {job.latest_quote.currency}
            </div>
          )}
        </div>

        {/* Status and Partner Badge */}
        <div className="space-y-2" onClick={onCardClick}>
          <Badge className={`text-xs ${getStatusColor(job.partner_status)}`}>
            {getStatusLabel(job.partner_status)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {partnerName.toUpperCase()}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInPartner();
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in {partnerName}
          </Button>
          
          {!readOnly && onAddQuote && (job.partner_status === 'AWAITING_QUOTATION' || 
           job.partner_status === 'QUOTE_REJECTED' || 
           job.partner_status === 'QUOTE_REWORK_REQUESTED') && (
            <Button
              variant="default"
              size="sm"
              className="text-xs h-7"
              onClick={(e) => {
                e.stopPropagation();
                onAddQuote();
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Quote
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
