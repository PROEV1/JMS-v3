import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Clock, User, Mail, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Order, getOrderEstimatedHours } from '@/utils/schedulingUtils';
import { getBestPostcode } from '@/utils/postcodeUtils';
import { format, addDays, startOfDay, isBefore } from 'date-fns';

interface Engineer {
  id: string;
  name: string;
  email: string;
}

interface SendOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  engineers: Engineer[];
  preselectedEngineerId?: string;
  preselectedDate?: Date;
  onOfferSent?: () => void;
}

export function SendOfferModal({
  isOpen,
  onClose,
  order,
  engineers,
  preselectedEngineerId,
  preselectedDate,
  onOfferSent
}: SendOfferModalProps) {
  const queryClient = useQueryClient();
  const [selectedEngineerId, setSelectedEngineerId] = useState(preselectedEngineerId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [timeWindow, setTimeWindow] = useState('AM (9:00 - 12:00)');
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const { toast } = useToast();

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);

  // Fetch engineer availability when engineer is selected
  const { data: engineerAvailability, isLoading: loadingAvailability } = useQuery({
    queryKey: ['engineer-availability', selectedEngineerId],
    queryFn: async () => {
      if (!selectedEngineerId) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select(`
          *,
          engineer_availability(*)
        `)
        .eq('id', selectedEngineerId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEngineerId
  });

  // Calculate available dates based on engineer availability
  useEffect(() => {
    if (!engineerAvailability?.engineer_availability) {
      setAvailableDates([]);
      return;
    }

    const availableDaysOfWeek = engineerAvailability.engineer_availability
      .filter((avail: any) => avail.is_available)
      .map((avail: any) => avail.day_of_week);

    // Generate next 60 days and filter by engineer availability
    const dates: Date[] = [];
    const today = new Date();
    
    for (let i = 1; i <= 60; i++) { // Start from tomorrow
      const date = addDays(today, i);
      const dayOfWeek = date.getDay();
      
      if (availableDaysOfWeek.includes(dayOfWeek)) {
        dates.push(date);
      }
    }
    
    setAvailableDates(dates);
    
    // Clear selected date if it's no longer available
    if (selectedDate && !dates.some(d => d.toDateString() === selectedDate.toDateString())) {
      setSelectedDate(undefined);
    }
  }, [engineerAvailability, selectedDate]);

  // Reset form when engineer changes
  useEffect(() => {
    if (selectedEngineerId !== preselectedEngineerId) {
      setSelectedDate(undefined);
    }
  }, [selectedEngineerId, preselectedEngineerId]);

  const handleSendOffer = async () => {
    if (!selectedEngineerId || !selectedDate) {
      toast({
        title: "Validation Error",
        description: 'Please select an engineer and date',
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-offer', {
        body: {
          order_id: order.id,
          engineer_id: selectedEngineerId,
          offered_date: selectedDate.toISOString(),
          time_window: timeWindow,
          delivery_channel: deliveryChannel,
          custom_message: customMessage || undefined
        }
      });

      // Handle structured error responses from the backend
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error('Network error occurred');
      }

      if (data?.error) {
        if (data.error === 'engineer_not_available' && data.details) {
          const { message, details } = data;
          throw new Error(`${message}. Available days: ${details.available_days.join(', ')}`);
        }
        throw new Error(data.message || data.error || 'Failed to send offer');
      }

       toast({
         title: "Success",
         description: 'Installation offer sent successfully!',
       });
       
       // Invalidate all order-related queries to refresh the UI
       await queryClient.invalidateQueries({ queryKey: ['orders'] });
       await queryClient.invalidateQueries({ queryKey: ['schedule-counts'] });
       
       onOfferSent?.();
       // Trigger refresh for status tiles
       window.dispatchEvent(new CustomEvent('scheduling:refresh'));
       
       // Close modal after a short delay to ensure refresh completes
       setTimeout(() => {
         handleClose();
       }, 300);

    } catch (err: any) {
      console.error('Error sending offer:', err);
      
      // Handle specific error types
      const errorMessage = err.message || 'Failed to send offer';
      
      // Special handling for engineer availability errors
      if (errorMessage.includes('not available on')) {
        toast({
          title: "Something went wrong",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (errorMessage.includes('at capacity') || errorMessage.includes('exceed')) {
        toast({
          title: "Something went wrong",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: 'Failed to send offer. Please try again.',
          variant: "destructive",
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Installation Offer
          </DialogTitle>
          <DialogDescription>
            Send an installation slot offer for Order #{order.order_number} to the client
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Order Number</Label>
                <p className="text-sm">{order.order_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                <p className="text-sm">{order.client?.full_name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="text-sm">{order.job_address || 'Not specified'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Postcode</Label>
                <p className="text-sm">{getBestPostcode(order) || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Estimated Duration</Label>
                <p className="text-sm">{getOrderEstimatedHours(order)} hours</p>
              </div>
            </CardContent>
          </Card>

          {/* Offer Configuration */}
          <div className="space-y-4">
            {/* Engineer Selection */}
            <div>
              <Label htmlFor="engineer" className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                Select Engineer
              </Label>
              <Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an engineer..." />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name} ({engineer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4" />
                Installation Date
              </Label>
              
              {loadingAvailability ? (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
                  <AlertCircle className="h-4 w-4 text-muted-foreground animate-pulse" />
                  <span className="text-sm text-muted-foreground">Loading available dates...</span>
                </div>
              ) : !selectedEngineerId ? (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Select an engineer first to see available dates</span>
                </div>
              ) : availableDates.length === 0 ? (
                <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">No available dates found for this engineer</span>
                </div>
              ) : (
                <div className="border rounded-md">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      // Disable past dates and dates not in available dates
                      const today = startOfDay(new Date());
                      return isBefore(date, today) || !availableDates.some(d => 
                        d.toDateString() === date.toDateString()
                      );
                    }}
                    className="p-3"
                  />
                </div>
              )}
              
              {selectedDate && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </p>
              )}
              
              {availableDates.length > 0 && selectedEngineerId && (
                <p className="text-sm text-green-600 mt-2">
                  {availableDates.length} available dates found for this engineer
                </p>
              )}
            </div>

            {/* Time Window */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                Time Window
              </Label>
              <Select value={timeWindow} onValueChange={setTimeWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM (9:00 - 12:00)">Morning (9:00 AM - 12:00 PM)</SelectItem>
                  <SelectItem value="PM (1:00 - 5:00)">Afternoon (1:00 PM - 5:00 PM)</SelectItem>
                  <SelectItem value="Full Day (9:00 - 5:00)">Full Day (9:00 AM - 5:00 PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Method */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4" />
                Delivery Method
              </Label>
              <Select value={deliveryChannel} onValueChange={(value: 'email' | 'sms' | 'whatsapp') => setDeliveryChannel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Message */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" />
                Custom Message (Optional)
              </Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add any additional information for the client..."
                rows={3}
              />
            </div>
          </div>

        {/* Confirmation Summary */}
        {selectedEngineerId && selectedDate && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                Offer Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-green-800">
              <div>
                <p className="text-sm">
                  <strong>Date:</strong> {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm">
                  <strong>Time:</strong> {timeWindow}
                </p>
                <p className="text-sm">
                  <strong>Engineer:</strong> {selectedEngineer?.name}
                </p>
                <p className="text-sm">
                  <strong>Method:</strong> {deliveryChannel.charAt(0).toUpperCase() + deliveryChannel.slice(1)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendOffer} 
            disabled={sending || !selectedEngineerId || !selectedDate || loadingAvailability}
            className="min-w-[120px]"
          >
            {sending ? 'Sending...' : loadingAvailability ? 'Loading...' : 'Send Offer'}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}