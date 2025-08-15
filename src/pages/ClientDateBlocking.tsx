import React from 'react';
import Layout from '@/components/Layout';
import { ClientDateBlocker } from '@/components/scheduling/ClientDateBlocker';
import { useUserRole } from '@/hooks/useUserRole';

export default function ClientDateBlocking() {
  const { role: userRole, loading } = useUserRole();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (userRole !== 'client') {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available to clients.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-6xl">
        <ClientDateBlocker />
      </div>
    </Layout>
  );
}