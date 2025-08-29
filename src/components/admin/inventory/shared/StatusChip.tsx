import React from 'react';
import { Badge } from '@/components/ui/badge';

type StatusVariant = 'submitted' | 'approved' | 'rejected' | 'in_pick' | 'in_transit' | 'cancelled' | 'pending' | 'active' | 'inactive';

interface StatusChipProps {
  status: StatusVariant;
  children: React.ReactNode;
}

const statusStyles: Record<StatusVariant, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  approved: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  rejected: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  in_pick: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  in_transit: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  cancelled: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  pending: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  active: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  inactive: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
};

export function StatusChip({ status, children }: StatusChipProps) {
  return (
    <Badge 
      variant="outline" 
      className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyles[status]}`}
    >
      {children}
    </Badge>
  );
}