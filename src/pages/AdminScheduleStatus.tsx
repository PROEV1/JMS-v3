
import React from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleStatusListPage } from '@/components/scheduling/ScheduleStatusListPage';
import { CompletionPendingListPage } from '@/components/scheduling/CompletionPendingListPage';
import { CompletedListPage } from '@/components/scheduling/CompletedListPage';
import { CancelledListPage } from '@/components/scheduling/CancelledListPage';
import { NotInSchedulingListPage } from '@/components/scheduling/NotInSchedulingListPage';
import { ScheduleStatusNavigation } from '@/components/scheduling/ScheduleStatusNavigation';

export default function AdminScheduleStatus() {
  const { status } = useParams<{ status: string }>();

  return (
    <div className="space-y-6">
      {/* Always show the bucket navigation tiles */}
      <ScheduleStatusNavigation currentStatus={status} />
      
      {/* Render the appropriate status page */}
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
          default:
            return <ScheduleStatusListPage orders={[]} engineers={[]} title="Schedule Status" />;
        }
      })()}
    </div>
  );
}
