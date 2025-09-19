import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertTriangle, X, CheckSquare } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDispatch: () => void;
  onBulkFlagIssue: () => void;
  onBulkStatusChange: (status: string) => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDispatch,
  onBulkFlagIssue,
  onBulkStatusChange
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 flex items-center gap-4 min-w-[500px]">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          <Badge variant="secondary">
            {selectedCount} selected
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onBulkDispatch}
            className="bg-green-600 hover:bg-green-700"
          >
            <Package className="mr-2 h-4 w-4" />
            Mark as Dispatched
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={onBulkFlagIssue}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Flag Issue
          </Button>

          <Select onValueChange={onBulkStatusChange}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="issue">Flag Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}