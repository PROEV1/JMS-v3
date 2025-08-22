
import React from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleStatusListPage } from '@/components/scheduling/ScheduleStatusListPage';
import { CompletionPendingListPage } from '@/components/scheduling/CompletionPendingListPage';
import { CompletedListPage } from '@/components/scheduling/CompletedListPage';
import { CancelledListPage } from '@/components/scheduling/CancelledListPage';
import { NotInSchedulingListPage } from '@/components/scheduling/NotInSchedulingListPage';
import { ScheduleStatusNavigation } from '@/components/scheduling/ScheduleStatusNavigation';
import { NeedsSchedulingListPage } from '@/components/scheduling/NeedsSchedulingListPage';

export default function AdminScheduleStatus() {
  const { status } = useParams<{ status: string }>();

  return (
    <div className="space-y-6">
      {/* Render the appropriate status page (each includes its own navigation) */}
      {(() => {
        switch (status) {
          case 'completion-pending':
            return <CompletionPendingListPage />;
          case 'completed':
            return <CompletedListPage />;
          case 'cancelled':
            return <CancelledListPage />;
          case 'not-in-scheduling':
            return <NotInSchedulingListPage />;
          case 'needs-scheduling':
          default:
            return <NeedsSchedulingListPage />;
        }
      })()}
    </div>
  );
}
