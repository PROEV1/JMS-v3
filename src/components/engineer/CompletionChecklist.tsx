import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
}

interface CompletionChecklistProps {
  jobId: string;
  onChecklistChange: (completedItems: string[], isAllComplete: boolean) => void;
  disabled?: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'doors_tested',
    label: 'All doors tested',
    description: 'Verify all doors open and close smoothly'
  },
  {
    id: 'drawers_aligned',
    label: 'Drawers properly aligned',
    description: 'Check drawer alignment and smooth operation'
  },
  {
    id: 'push_mechanism',
    label: 'Push-to-open mechanism functional',
    description: 'Test push-to-open mechanism on all applicable units'
  },
  {
    id: 'area_cleaned',
    label: 'Installation area cleaned',
    description: 'Remove all packaging and clean workspace'
  },
  {
    id: 'customer_walkthrough',
    label: 'Customer walkthrough completed',
    description: 'Demonstrated operation to customer'
  },
  {
    id: 'warranty_explained',
    label: 'Warranty information provided',
    description: 'Explained warranty terms and care instructions'
  }
];

export default function CompletionChecklist({ 
  jobId, 
  onChecklistChange, 
  disabled = false 
}: CompletionChecklistProps) {
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const { data, error } = await supabase
          .from('order_completion_checklist')
          .select('item_id, is_completed')
          .eq('order_id', jobId);

        if (error) throw error;

        if (data && data.length > 0) {
          const completed = data.filter(item => item.is_completed).map(item => item.item_id);
          setCompletedItems(completed);
        } else {
          // Initialize checklist items in database if they don't exist
          const checklistData = CHECKLIST_ITEMS.map(item => ({
            order_id: jobId,
            item_id: item.id,
            item_label: item.label,
            item_description: item.description,
            is_completed: false
          }));

          await supabase
            .from('order_completion_checklist')
            .insert(checklistData);
        }
      } catch (error) {
        console.error('Error loading checklist:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem(`checklist_${jobId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setCompletedItems(parsed);
          } catch (parseError) {
            console.error('Error parsing saved checklist:', parseError);
          }
        }
      }
    };

    loadChecklist();
  }, [jobId]);

  useEffect(() => {
    // Notify parent component
    const isAllComplete = completedItems.length === CHECKLIST_ITEMS.length;
    onChecklistChange(completedItems, isAllComplete);
  }, [completedItems, onChecklistChange]);

  const handleItemToggle = async (itemId: string, checked: boolean) => {
    if (disabled) return;
    
    try {
      // Update database
      await supabase
        .from('order_completion_checklist')
        .update({ 
          is_completed: checked,
          completed_at: checked ? new Date().toISOString() : null
        })
        .eq('order_id', jobId)
        .eq('item_id', itemId);

      // Update local state
      setCompletedItems(prev => {
        if (checked) {
          return [...prev, itemId];
        } else {
          return prev.filter(id => id !== itemId);
        }
      });

      // Also save to localStorage as backup
      localStorage.setItem(`checklist_${jobId}`, JSON.stringify(completedItems));
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({
        title: "Error",
        description: "Failed to update checklist item",
        variant: "destructive",
      });
    }
  };

  const progressPercentage = (completedItems.length / CHECKLIST_ITEMS.length) * 100;
  const isAllComplete = completedItems.length === CHECKLIST_ITEMS.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5" />
          <span>Installation Checklist</span>
        </CardTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{completedItems.length} of {CHECKLIST_ITEMS.length} items completed</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = completedItems.includes(item.id);
          
          return (
            <div key={item.id} className="flex items-start space-x-3">
              <Checkbox
                id={item.id}
                checked={isChecked}
                onCheckedChange={(checked) => handleItemToggle(item.id, checked === true)}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <Label 
                  htmlFor={item.id} 
                  className={`font-medium cursor-pointer ${
                    isChecked ? 'line-through text-muted-foreground' : ''
                  } ${disabled ? 'cursor-not-allowed' : ''}`}
                >
                  {item.label}
                </Label>
                {item.description && (
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {isAllComplete && !disabled && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">All items completed!</span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              You can now proceed with the final sign-off.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}