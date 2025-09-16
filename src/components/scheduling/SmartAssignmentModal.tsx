import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Order, Engineer, getSmartEngineerRecommendations, getOrderEstimatedHours, getEngineerSettings } from '@/utils/schedulingUtils';
import { getBestPostcode } from '@/utils/postcodeUtils';
import { MapPin, Clock, User, CheckCircle, Send, Calendar, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SmartAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  engineers: Engineer[];
  onAssign: (engineerId: string, date: string, action: 'send_offer' | 'confirm_book') => Promise<void>;
}

interface EngineerSuggestion {
  engineer: Engineer;
  availableDate?: string;
  distance: number;
  travelTime: number;
  score: number;
  reasons: string[];
  dailyWorkloadThatDay?: number;
  travelSource: 'mapbox' | 'service-area-estimate' | 'fallback-default';
}

export function SmartAssignmentModal({ 
  isOpen, 
  onClose, 
  order, 
  engineers, 
  onAssign 
}: SmartAssignmentModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    order.scheduled_install_date ? new Date(order.scheduled_install_date) : undefined
  );
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>(
    order.engineer_id || ''
  );
  const [suggestions, setSuggestions] = useState<EngineerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  // Helper function to check if engineer is available on a specific date
  const isEngineerAvailableOnDate = async (engineerId: string, date: Date): Promise<boolean> => {
    try {
      const engineerSettings = await getEngineerSettings(engineerId);
      if (!engineerSettings) return false;

      const dayOfWeek = date.getDay();
      const workingDay = engineerSettings.working_hours.find(wh => wh.day_of_week === dayOfWeek);
      
      if (!workingDay || !workingDay.is_available) return false;

      // Check for time off
      const dateString = date.toISOString().split('T')[0];
      const hasTimeOff = engineerSettings.time_off.some(timeOff => 
        dateString >= timeOff.start_date && dateString <= timeOff.end_date
      );

      return !hasTimeOff;
    } catch (error) {
      console.error('Error checking engineer availability:', error);
      return false;
    }
  };

  // Load available dates when engineer changes
  useEffect(() => {
    if (!selectedEngineerId || !isOpen) {
      setAvailableDates([]);
      return;
    }

    const loadAvailableDates = async () => {
      setLoadingAvailability(true);
      try {
        // First fetch scheduling settings to respect advance notice
        const { getSchedulingSettings } = await import('@/utils/schedulingUtils');
        const settings = await getSchedulingSettings();
        
        // Load client blocked dates
        const { data: clientBlockedDates } = await supabase
          .from('client_blocked_dates')
          .select('blocked_date')
          .eq('client_id', order.client_id);

        const blocked = new Set(clientBlockedDates?.map(d => d.blocked_date) || []);
        setBlockedDates(blocked);

        // Calculate minimum start date respecting advance notice rule
        const now = new Date();
        const minimumStartDate = new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
        const maxDate = new Date(minimumStartDate.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days from minimum start date

        // Calculate available dates starting from minimum advance notice date
        const dates: Date[] = [];
        for (let d = new Date(minimumStartDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
          const dateString = d.toISOString().split('T')[0];
          
          // Skip if client blocked date
          if (blocked.has(dateString)) continue;
          
          // Skip weekends (can be made configurable)
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          
          // Check engineer availability
          if (await isEngineerAvailableOnDate(selectedEngineerId, d)) {
            dates.push(new Date(d));
          }
        }

        setAvailableDates(dates);
        
        // Auto-select first available date if none selected
        if (!selectedDate && dates.length > 0) {
          setSelectedDate(dates[0]);
        }
      } catch (error) {
        console.error('Error loading available dates:', error);
        setAvailableDates([]);
      } finally {
        setLoadingAvailability(false);
      }
    };

    loadAvailableDates();
  }, [selectedEngineerId, isOpen, order.client_id]);

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when closing
      setSelectedDate(undefined);
      setSelectedEngineerId('');
      setSuggestions([]);
      setAvailableDates([]);
      setBlockedDates(new Set());
      setProcessing(false);
      setLoading(false);
      setLoadingAvailability(false);
    } else {
      // Initialize state when opening
      setSelectedDate(order.scheduled_install_date ? new Date(order.scheduled_install_date) : undefined);
      setSelectedEngineerId(order.engineer_id || '');
      setSuggestions([]);
      setAvailableDates([]);
      setBlockedDates(new Set());
      setProcessing(false);
      setLoading(false);
      setLoadingAvailability(false);
    }
  }, [isOpen, order.id]);

  // Load smart suggestions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSuggestions = async () => {
      setLoading(true);
      try {
        // First fetch scheduling settings
        const { getSchedulingSettings } = await import('@/utils/schedulingUtils');
        const settings = await getSchedulingSettings();
        
        // Calculate earliest available start date based on client blocked dates
        const { data: clientBlockedDates } = await supabase
          .from('client_blocked_dates')
          .select('blocked_date')
          .eq('client_id', order.client_id)
          .order('blocked_date', { ascending: false })
          .limit(1);

        // Calculate minimum start date based on advance notice settings
        const now = new Date();
        let startDate = new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
        
        // Also consider client blocked dates
        if (clientBlockedDates && clientBlockedDates.length > 0) {
          const lastBlockedDate = new Date(clientBlockedDates[0].blocked_date);
          const dayAfterLastBlocked = new Date(lastBlockedDate);
          dayAfterLastBlocked.setDate(dayAfterLastBlocked.getDate() + 1);
          
          // Use the later date between minimum advance date and day after last blocked date
          if (dayAfterLastBlocked > startDate) {
            startDate = dayAfterLastBlocked;
            console.log(`Client has blocked dates until ${clientBlockedDates[0].blocked_date}, starting search from ${startDate.toISOString().split('T')[0]}`);
          }
        }

        const result = await getSmartEngineerRecommendations(order, getBestPostcode(order), {
          fastMode: true,
          startDate: startDate
        });
        setSuggestions(result.recommendations);
        
        // Auto-select the first engineer (don't auto-select date - let availability loading handle it)
        if (!selectedEngineerId && result.recommendations.length > 0) {
          setSelectedEngineerId(result.recommendations[0].engineer.id);
        }
      } catch (error) {
        console.error('Error loading suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [isOpen, order, engineers]);

  const handleSendToClient = async () => {
    if (!selectedEngineerId || !selectedDate) {
      toast.error('Please select both an engineer and date');
      return;
    }

    setProcessing(true);
    try {
      // Let parent handle the send-offer logic - send as date string to avoid timezone issues
      const dateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      await onAssign(selectedEngineerId, dateString, 'send_offer');
      
      // Trigger refresh for status tiles
      window.dispatchEvent(new CustomEvent('scheduling:refresh'));
      
      // Close modal after successful send
      setTimeout(() => {
        onClose();
      }, 300);
      
    } catch (error: any) {
      console.error('Error sending offer:', error);
      
      // Handle specific error types from send-offer function
      if (error.message && error.message.includes('not available on')) {
        const engineerName = suggestions.find(s => s.engineer.id === selectedEngineerId)?.engineer.name || 'Engineer';
        toast.error(`${engineerName} is not available on the selected date. Please choose a different date or engineer.`);
      } else if (error.message && error.message.includes('at capacity')) {
        toast.error('Engineer is at capacity on this date. Please choose a different date or engineer.');
      } else if (error.message && error.message.includes('exceed working hours')) {
        toast.error('This booking would exceed the engineer\'s working hours. Please choose a different date or engineer.');
      } else {
        toast.error(error.message || 'Failed to send offer to client');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAndBook = async () => {
    console.log('🚀 Smart Assignment Modal: handleConfirmAndBook called');
    console.log('🚀 Selected engineer:', selectedEngineerId);
    console.log('🚀 Selected date:', selectedDate);
    
    if (!selectedEngineerId || !selectedDate) {
      console.log('❌ Missing engineer or date');
      toast.error('Please select both an engineer and date');
      return;
    }

    setProcessing(true);
    try {
      // Send as date string to avoid timezone issues
      const dateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('🚀 Smart Assignment Modal: Confirming and booking for engineer', selectedEngineerId, 'on date', dateString);
      console.log('🚀 Smart Assignment Modal: Calling onAssign with action confirm_book');
      
      await onAssign(selectedEngineerId, dateString, 'confirm_book');
      
      console.log('🚀 Smart Assignment Modal: onAssign completed successfully');
      
      // Trigger global refresh to update all status counts and lists
      window.dispatchEvent(new CustomEvent('scheduling:refresh'));
      
      toast.success('Installation booked successfully');
      onClose();
    } catch (error: any) {
      console.error('❌ Smart Assignment Modal: Error booking installation:', error);
      toast.error(error.message || 'Failed to book installation');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Job Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Order:</strong> {order.order_number}
                </div>
                <div>
                  <strong>Client:</strong> {order.client?.full_name}
                </div>
                <div>
                  <strong>Address:</strong> {order.job_address || order.client?.address}
                </div>
                <div>
                  <strong>Postcode:</strong> {getBestPostcode(order) || 'N/A'}
                </div>
                <div>
                  <strong>Duration:</strong> {getOrderEstimatedHours(order)} hours
                </div>
                {order.time_window && (
                  <div>
                    <strong>Preferred Time:</strong> {order.time_window}
                  </div>
                )}
                <div>
                  <strong>Status:</strong> {order.status_enhanced.replace('_', ' ')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engineer Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Engineer Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Finding best matches...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No engineer suggestions available
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.engineer.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedEngineerId === suggestion.engineer.id 
                          ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                          : 'border-border hover:border-primary/50'
                      }`}
                       onClick={() => {
                          setSelectedEngineerId(suggestion.engineer.id);
                          // Auto-set the suggested date for this engineer
                          if (suggestion.availableDate) {
                            setSelectedDate(new Date(suggestion.availableDate));
                          }
                        }}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {suggestion.engineer.name}
                                <CheckCircle className="h-4 w-4 text-success" />
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {suggestion.engineer.region}
                              </p>
                               {suggestion.availableDate && (
                                <p className="text-xs text-primary font-medium">
                                  Suggested date: {new Date(suggestion.availableDate).toLocaleDateString()}
                                </p>
                               )}
                            </div>
                            <Badge variant="default">
                              Score: {Math.round(suggestion.score)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{suggestion.distance.toFixed(1)}mi away</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{suggestion.travelTime}min travel</span>
                            </div>
                          </div>
                          <div className="flex justify-start mt-1">
                            <Badge 
                              variant={suggestion.travelSource === 'mapbox' ? 'default' : 'secondary'} 
                              className="text-xs"
                            >
                              {suggestion.travelSource === 'mapbox' ? 'Live Distance' : 
                               suggestion.travelSource === 'service-area-estimate' ? 'Estimated' : 'Default'}
                            </Badge>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {suggestion.reasons.slice(0, 2).map((reason, idx) => (
                              <div key={idx}>• {reason}</div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
           </Card>


          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={handleSendToClient}
                disabled={!selectedEngineerId || !selectedDate || processing}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {processing ? 'Sending...' : 'Send to Client'}
              </Button>
              
              <Button 
                onClick={handleConfirmAndBook}
                disabled={!selectedEngineerId || !selectedDate || processing}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {processing ? 'Booking...' : 'Confirm & Book'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}