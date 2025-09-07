import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ErrorBoundaryRouteProps {
  children: React.ReactNode;
}

export function ErrorBoundaryRoute({ children }: ErrorBoundaryRouteProps) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}