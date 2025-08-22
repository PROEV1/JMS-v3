import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  disabled?: boolean;
}

interface QuickActionsBlockProps {
  title?: string;
  actions: QuickAction[];
}

export function QuickActionsBlock({ title = "Quick Actions", actions }: QuickActionsBlockProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => {
          const IconComponent = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || (index === 0 ? 'default' : 'secondary')}
              onClick={action.onClick}
              disabled={action.disabled}
              className="flex items-center gap-2"
            >
              <IconComponent className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}