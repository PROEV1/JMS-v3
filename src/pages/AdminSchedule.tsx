import React from 'react';
import { AdminScheduleCalendar } from '@/components/scheduling/AdminScheduleCalendar';
import { useUserRole } from '@/hooks/useUserRole';

export default function AdminSchedule() {
  const { role: userRole, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          You don't have permission to access the scheduling system.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <AdminScheduleCalendar />
    </div>
  );
}