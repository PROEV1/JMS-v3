import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Camera } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateStockRequest } from '@/hooks/useStockRequests';
import { StockRequestPriority } from '@/types/stock-request';

const stockRequestSchema = z.object({
  destination_location_id: z.string().min(1, 'Destination is required'),
  order_id: z.string().optional(),
  needed_by: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  notes: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().min(1, 'Item is required'),
    qty: z.number().min(1, 'Quantity must be at least 1'),
    notes: z.string().optional()
  })).min(1, 'At least one item is required')
});

type StockRequestFormData = z.infer<typeof stockRequestSchema>;

interface StockRequestFormProps {
  engineerId: string;
  orderId?: string;
  onClose?: () => void;
  prefilledItems?: Array<{ item_id: string; qty: number; notes?: string }>;
}

export const StockRequestForm: React.FC<StockRequestFormProps> = ({
  engineerId,
  orderId,
  onClose,
  prefilledItems = []
}) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const createRequest = useCreateStockRequest();

  const form = useForm<StockRequestFormData>({
    resolver: zodResolver(stockRequestSchema),
    defaultValues: {
      destination_location_id: '',
      order_id: orderId || '',
      needed_by: '',
      priority: 'medium' as StockRequestPriority,
      notes: '',
      lines: prefilledItems.length > 0 ? prefilledItems : [{ item_id: '', qty: 1, notes: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  });

  // Get van locations for engineer
  const { data: locations } = useQuery({
    queryKey: ['engineer-locations', engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('*')
        .eq('type', 'van')
        .eq('engineer_id', engineerId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as Array<{ id: string; name: string; code?: string }>;
    }
  });

  // Get inventory items
  const { data: items } = useQuery({
    queryKey: ['inventory-items-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Array<{ id: string; name: string; sku: string; unit: string }>;
    }
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('stock-request-attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-request-attachments')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Photo upload failed:', error);
      return null;
    }
  };

  const onSubmit = async (data: StockRequestFormData) => {
    try {
      let photoUrl: string | undefined;
      
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile) || undefined;
      }

      // Filter out lines with missing required data and ensure proper typing
      const validLines = data.lines
        .filter(line => line.item_id && line.qty > 0)
        .map(line => ({
          item_id: line.item_id!,
          qty: line.qty!,
          notes: line.notes
        }));

      if (validLines.length === 0) {
        throw new Error('At least one valid item is required');
      }

      // Ensure all required fields are present with proper typing
      const requestData = {
        destination_location_id: data.destination_location_id,
        order_id: data.order_id || undefined,
        needed_by: data.needed_by || undefined,
        priority: data.priority,
        notes: data.notes || undefined,
        lines: validLines,
        engineer_id: engineerId,
        photo_url: photoUrl
      };

      await createRequest.mutateAsync(requestData);

      onClose?.();
    } catch (error) {
      console.error('Failed to submit request:', error);
    }
  };

  const defaultLocation = locations?.[0];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>New Stock Request</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="destination_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={defaultLocation?.id}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} {location.code && `(${location.code})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <Badge variant="secondary">Low</Badge>
                        </SelectItem>
                        <SelectItem value="medium">
                          <Badge variant="outline">Medium</Badge>
                        </SelectItem>
                        <SelectItem value="high">
                          <Badge variant="destructive">High</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="needed_by"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Needed by (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ item_id: '', qty: 1, notes: '' })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.item_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {items?.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} ({item.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.qty`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Input placeholder="Optional notes" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-1">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes or context..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Photo Attachment (optional)</FormLabel>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photoFile ? 'Change Photo' : 'Add Photo'}
                </Button>
                {photoFile && (
                  <span className="text-sm text-muted-foreground">
                    {photoFile.name}
                  </span>
                )}
              </div>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="flex gap-4 justify-end">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={createRequest.isPending}
              >
                {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
