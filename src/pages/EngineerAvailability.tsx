import React from 'react';
import { EngineerAvailabilityManager } from '@/components/engineer/EngineerAvailabilityManager';
import { useAuth } from '@/contexts/AuthContext';

export default function EngineerAvailability() {
  const { finalRole: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Updated role check for the new role system
  if (userRole !== 'admin' && userRole !== 'standard_office_user' && userRole !== 'engineer') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          This page is only available to admin users and engineers.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <EngineerAvailabilityManager />
    </div>
  );
}