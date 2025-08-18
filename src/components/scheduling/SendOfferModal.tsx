import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Clock, User, Mail, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Order, getOrderEstimatedHours } from '@/utils/schedulingUtils';

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
  const [selectedEngineerId, setSelectedEngineerId] = useState(preselectedEngineerId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [timeWindow, setTimeWindow] = useState('AM (9:00 - 12:00)');
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);

  const handleSendOffer = async () => {
    if (!selectedEngineerId || !selectedDate) {
      toast.error('Please select an engineer and date');
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

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to send offer');
      }

      toast.success('Installation offer sent successfully!');
      onOfferSent?.();
      onClose();

    } catch (err: any) {
      console.error('Error sending offer:', err);
      
      // Handle capacity-specific errors with more detail
      const errorMessage = err.message || 'Failed to send offer';
      if (errorMessage.includes('at capacity') || errorMessage.includes('exceed') || errorMessage.includes('not available')) {
        toast.error(errorMessage);
      } else {
        toast.error('Failed to send offer. Please try again.');
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Order Number</Label>
                <p className="font-semibold">{order.order_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                <p className="font-semibold">{order.client?.full_name}</p>
                <p className="text-sm text-muted-foreground">{order.client?.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="text-sm">{order.job_address || 'Not specified'}</p>
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
              <div className="border rounded-md">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="p-3"
                />
              </div>
            </div>

            {/* Time Window */}
            <div>
              <Label htmlFor="timeWindow" className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                Time Window
              </Label>
              <Select value={timeWindow} onValueChange={setTimeWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM (9:00 - 12:00)">Morning (9:00 - 12:00)</SelectItem>
                  <SelectItem value="PM (12:00 - 17:00)">Afternoon (12:00 - 17:00)</SelectItem>
                  <SelectItem value="All Day (9:00 - 17:00)">All Day (9:00 - 17:00)</SelectItem>
                  <SelectItem value="To be confirmed">To be confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Channel */}
            <div>
              <Label htmlFor="channel" className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4" />
                Delivery Method
              </Label>
              <Select value={deliveryChannel} onValueChange={(value: 'email' | 'sms' | 'whatsapp') => setDeliveryChannel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email (Recommended)</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Message */}
            <div>
              <Label htmlFor="message" className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" />
                Custom Message (Optional)
              </Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to include with the offer..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use the default template message
              </p>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {selectedDate && selectedEngineer && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Offer Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>To:</strong> {order.client?.full_name} ({order.client?.email})
                </p>
                <p className="text-sm">
                  <strong>Date:</strong> {selectedDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-sm">
                  <strong>Time:</strong> {timeWindow}
                </p>
                <p className="text-sm">
                  <strong>Engineer:</strong> {selectedEngineer.name}
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
            disabled={!selectedEngineerId || !selectedDate || sending}
          >
            {sending ? 'Sending...' : 'Send Offer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}