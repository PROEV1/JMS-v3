
import React, { useState } from 'react';
import { useForm, useFieldArray, DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateStockRequest } from '@/hooks/useStockRequests';
import { useToast } from '@/hooks/use-toast';

// Keep schema simple and flat for the form layer
const StockRequestSchema = z.object({
  destination_location_id: z.string().min(1, 'Please select a destination'),
  job_id: z.string().nullable().optional(),
  priority: z.enum(['low','medium','high']).default('medium'),
  needed_by_date: z.string().nullable().optional(),
  notes: z.string().optional(),
  
  lines: z.array(z.object({
    item_id: z.string().min(1, 'Please select an item'),
    qty: z.number().min(1, 'Quantity must be at least 1')
  })).min(1, 'At least one item is required')
});

type StockRequestFormValues = z.infer<typeof StockRequestSchema>;

const defaults: DefaultValues<StockRequestFormValues> = {
  destination_location_id: '',
  job_id: null,
  priority: 'medium',
  needed_by_date: null,
  notes: '',
  
  lines: [{ item_id: '', qty: 1 }]
};

interface StockRequestFormProps {
  engineerId: string;
  orderId?: string;
  onClose: () => void;
  prefilledItems?: Array<{ item_id: string; qty: number; notes?: string }>;
}

interface LocationData {
  id: string;
  name: string;
  code: string | null;
}

interface ItemData {
  id: string;
  name: string;
  sku: string;
  unit: string;
  min_level: number | null;
  max_level: number | null;
  reorder_point: number | null;
}

export const StockRequestForm: React.FC<StockRequestFormProps> = ({
  engineerId,
  orderId,
  onClose,
  prefilledItems = []
}) => {
  
  const createRequest = useCreateStockRequest();
  const { toast } = useToast();

  const form = useForm<StockRequestFormValues>({
    resolver: zodResolver(StockRequestSchema),
    defaultValues: {
      ...defaults,
      job_id: orderId || null,
      lines: prefilledItems.length > 0 ? prefilledItems.map(item => ({ item_id: item.item_id, qty: item.qty })) : [{ item_id: '', qty: 1 }]
    },
    mode: 'onSubmit'
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  });

  // Get van locations for engineer - completely avoid complex types
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        
        // Fetch locations
        const { data: locationData, error: locationError } = await supabase
          .from('inventory_locations')
          .select('id, name, code')
          .eq('type', 'van')
          .eq('engineer_id', engineerId)
          .eq('is_active', true);
        
        if (locationError) {
          console.error('Location fetch error:', locationError);
          throw locationError;
        }
        
        // Fetch ALL active inventory items
        const { data: itemData, error: itemError } = await supabase
          .from('inventory_items')
          .select('id, name, sku, unit, min_level, max_level, reorder_point')
          .eq('is_active', true)
          .order('name');

        if (itemError) {
          console.error('Items fetch error:', itemError);
          throw itemError;
        }

        console.log('Fetched locations:', locationData);
        console.log('Fetched items:', itemData);

        setLocations(locationData || []);
        setItems(itemData || []);
        
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          title: "Error",
          description: "Failed to load inventory data",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [engineerId, toast]);


  const onSubmit = async (values: StockRequestFormValues) => {
    try {
      console.log('Form submission values:', values);
      
      // Validate that destination is selected
      if (!values.destination_location_id) {
        toast({
          title: "Error",
          description: "Please select a destination location",
          variant: "destructive",
        });
        return;
      }

      // Validate that at least one item is selected
      const validLines = values.lines.filter(line => line.item_id && line.qty > 0);
      if (validLines.length === 0) {
        toast({
          title: "Error", 
          description: "Please add at least one item with quantity > 0",
          variant: "destructive",
        });
        return;
      }

      // Map to lightweight DTO; avoid DB/Prisma/Supabase heavy types here
      const dto = {
        destination_location_id: values.destination_location_id,
        order_id: values.job_id ?? null,
        needed_by: values.needed_by_date ?? null,
        priority: values.priority,
        notes: values.notes ?? '',
        photo_url: undefined,
        lines: validLines.map(l => ({ 
          item_id: l.item_id, 
          qty: Number(l.qty),
          notes: undefined
        })),
        engineer_id: engineerId
      };

      console.log('Submitting DTO:', dto);
      await createRequest.mutateAsync(dto);
      onClose();
    } catch (error) {
      console.error('Failed to create stock request:', error);
      toast({
        title: "Error",
        description: "Failed to submit stock request. Please try again.",
        variant: "destructive",
      });
    }
  };


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="destination_location_id">Destination Location *</Label>
          <Select 
            value={form.watch('destination_location_id')} 
            onValueChange={(value) => form.setValue('destination_location_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations?.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name} {location.code && `(${location.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.destination_location_id && (
            <p className="text-sm text-red-500 mt-1">
              {form.formState.errors.destination_location_id.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select 
            value={form.watch('priority')}
            onValueChange={(value: 'low' | 'medium' | 'high') => form.setValue('priority', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="needed_by_date">Needed By (Optional)</Label>
        <Input
          type="date"
          {...form.register('needed_by_date')}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          {...form.register('notes')}
          placeholder="Additional notes about this request..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-medium">Items Requested *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ item_id: '', qty: 1 })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-4">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-5">
                  <Label className="text-sm">Item</Label>
                  <Select 
                    value={form.watch(`lines.${index}.item_id`) || ''}
                    onValueChange={(value) => form.setValue(`lines.${index}.item_id`, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50 max-h-[200px] overflow-y-auto">
                      {isLoadingData ? (
                        <SelectItem value="loading" disabled>
                          Loading items...
                        </SelectItem>
                      ) : items?.length === 0 ? (
                        <SelectItem value="no-items" disabled>
                          No items available
                        </SelectItem>
                      ) : (
                        items?.map((item) => (
                          <SelectItem key={item.id} value={item.id} className="bg-background hover:bg-accent">
                            <div className="flex flex-col">
                              <span className="font-medium">{item.name} ({item.sku})</span>
                              <span className="text-xs text-muted-foreground">
                                Min: {item.min_level ?? 'N/A'} | Max: {item.max_level ?? 'N/A'} | Reorder: {item.reorder_point ?? 'N/A'}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    {...form.register(`lines.${index}.qty`, { valueAsNumber: true })}
                  />
                </div>

                <div className="col-span-4">
                  {/* Notes removed for simpler form structure */}
                </div>

                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {form.formState.errors.lines && (
          <p className="text-sm text-red-500 mt-2">
            {form.formState.errors.lines.message}
          </p>
        )}
      </div>


      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createRequest.isPending}>
          {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  );
};
