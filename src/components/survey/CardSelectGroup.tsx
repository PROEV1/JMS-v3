import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface CardSelectGroupProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CardSelectGroup({ options, value, onChange, className }: CardSelectGroupProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3",
      className
    )}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.id;
        
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-700"
            )}
          >
            <Icon className={cn(
              "h-6 w-6 mb-2",
              isSelected ? "text-primary" : "text-slate-500"
            )} />
            <span className="font-medium text-sm">{option.label}</span>
            {option.description && (
              <span className="text-xs text-slate-500 mt-1 text-center">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}