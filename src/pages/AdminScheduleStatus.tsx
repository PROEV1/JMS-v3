
import React from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleStatusListPage } from '@/components/scheduling/ScheduleStatusListPage';
import { CompletionPendingListPage } from '@/components/scheduling/CompletionPendingListPage';
import { CompletedListPage } from '@/components/scheduling/CompletedListPage';
import { CancelledListPage } from '@/components/scheduling/CancelledListPage';

import { ScheduleStatusNavigation } from '@/components/scheduling/ScheduleStatusNavigation';
import { NeedsSchedulingListPage } from '@/components/scheduling/NeedsSchedulingListPage';
import { ScheduledListPage } from '@/components/scheduling/ScheduledListPage';
import { DateOfferedListPage } from '@/components/scheduling/DateOfferedListPage';
import { ReadyToBookListPage } from '@/components/scheduling/ReadyToBookListPage';
import { OnHoldListPage } from '@/components/scheduling/OnHoldListPage';
import { DateRejectedListPage } from '@/components/scheduling/DateRejectedListPage';
import { OfferExpiredListPage } from '@/components/scheduling/OfferExpiredListPage';
import { AwaitingPartsOrderListPage } from '@/components/scheduling/AwaitingPartsOrderListPage';
import { AwaitingManualSchedulingListPage } from '@/components/scheduling/AwaitingManualSchedulingListPage';

export default function AdminScheduleStatus() {
  const { status } = useParams<{ status: string }>();

  return (
    <div className="space-y-6">
      {/* Render the appropriate status page (each includes its own navigation) */}
      {(() => {
        switch (status) {
          case 'needs-scheduling':
            return <NeedsSchedulingListPage />;
          case 'awaiting-parts-order':
            return <AwaitingPartsOrderListPage />;
          case 'awaiting-manual-scheduling':
            return <AwaitingManualSchedulingListPage />;
          case 'date-offered':
            return <DateOfferedListPage />;
          case 'ready-to-book':
            return <ReadyToBookListPage />;
          case 'scheduled':
            return <ScheduledListPage />;
          case 'completion-pending':
            return <CompletionPendingListPage />;
          case 'completed':
            return <CompletedListPage />;
          case 'on-hold':
            return <OnHoldListPage />;
          case 'cancelled':
            return <CancelledListPage />;
          case 'date-rejected':
            return <DateRejectedListPage />;
          case 'offer-expired':
            return <OfferExpiredListPage />;
          default:
            return <NeedsSchedulingListPage />;
        }
      })()}
    </div>
  );
}
