import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Package,
  GraduationCap,
  Coffee,
  Wrench,
  Users,
  MoreHorizontal,
  Calendar,
  Clock
} from 'lucide-react';

interface AddCalendarItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineerId: string;
  selectedDate: Date;
  onItemAdded?: () => void;
}

const itemTypes = [
  { value: 'parts', label: 'Parts Delivery', icon: Package, color: '#3b82f6' },
  { value: 'training', label: 'Training', icon: GraduationCap, color: '#8b5cf6' },
  { value: 'time_off', label: 'Time Off', icon: Coffee, color: '#f59e0b' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: '#10b981' },
  { value: 'meeting', label: 'Meeting', icon: Users, color: '#ef4444' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: '#6b7280' }
];

export function AddCalendarItemModal({
  isOpen,
  onClose,
  engineerId,
  selectedDate,
  onItemAdded
}: AddCalendarItemModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_type: '',
    title: '',
    description: '',
    start_date: selectedDate.toISOString().split('T')[0],
    end_date: selectedDate.toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    all_day: true,
    color: '#3b82f6'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_type || !formData.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('calendar_items')
        .insert({
          engineer_id: engineerId,
          item_type: formData.item_type as any,
          title: formData.title,
          description: formData.description || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_time: formData.all_day ? null : formData.start_time,
          end_time: formData.all_day ? null : formData.end_time,
          all_day: formData.all_day,
          color: formData.color,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calendar item added successfully",
      });

      // Reset form
      setFormData({
        item_type: '',
        title: '',
        description: '',
        start_date: selectedDate.toISOString().split('T')[0],
        end_date: selectedDate.toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '17:00',
        all_day: true,
        color: '#3b82f6'
      });

      onItemAdded?.();
      onClose();
    } catch (error) {
      console.error('Error adding calendar item:', error);
      toast({
        title: "Error",
        description: "Failed to add calendar item",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (value: string) => {
    const selectedType = itemTypes.find(type => type.value === value);
    setFormData({
      ...formData,
      item_type: value,
      color: selectedType?.color || '#3b82f6'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Add Calendar Item
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Type */}
          <div className="space-y-2">
            <Label htmlFor="item_type">Type *</Label>
            <Select value={formData.item_type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: type.color }} />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description (optional)"
              rows={3}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="all_day"
              checked={formData.all_day}
              onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked === true })}
            />
            <Label htmlFor="all_day">All day</Label>
          </div>

          {/* Time Range (only if not all day) */}
          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color Preview */}
          {formData.item_type && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: formData.color }}
              />
              This item will appear in this color
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}