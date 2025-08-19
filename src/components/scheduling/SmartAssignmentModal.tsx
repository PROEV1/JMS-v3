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
import { Order, Engineer, getSmartEngineerRecommendations, getOrderEstimatedHours } from '@/utils/schedulingUtils';
import { getBestPostcode } from '@/utils/postcodeUtils';
import { MapPin, Clock, User, CheckCircle, Send, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when closing
      setSelectedDate(undefined);
      setSelectedEngineerId('');
      setSuggestions([]);
      setProcessing(false);
      setLoading(false);
    } else {
      // Initialize state when opening
      setSelectedDate(order.scheduled_install_date ? new Date(order.scheduled_install_date) : undefined);
      setSelectedEngineerId(order.engineer_id || '');
      setSuggestions([]);
      setProcessing(false);
      setLoading(false);
    }
  }, [isOpen, order.id]);

  // Load smart suggestions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const result = await getSmartEngineerRecommendations(order, getBestPostcode(order));
        setSuggestions(result.recommendations);
        
        // Auto-select the first available date if no date is selected
        if (!selectedDate && result.recommendations.length > 0 && result.recommendations[0].availableDate) {
          setSelectedDate(new Date(result.recommendations[0].availableDate));
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
      // Let parent handle the send-offer logic
      await onAssign(selectedEngineerId, selectedDate.toISOString(), 'send_offer');
      
      // Trigger refresh for status tiles
      window.dispatchEvent(new CustomEvent('scheduling:refresh'));
      
      // Close modal after successful send
      setTimeout(() => {
        onClose();
      }, 300);
      
    } catch (error) {
      console.error('Error sending offer:', error);
      toast.error('Failed to send offer to client');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAndBook = async () => {
    if (!selectedEngineerId || !selectedDate) {
      toast.error('Please select both an engineer and date');
      return;
    }

    setProcessing(true);
    try {
      await onAssign(selectedEngineerId, selectedDate.toISOString(), 'confirm_book');
      toast.success('Installation booked successfully');
      onClose();
    } catch (error) {
      console.error('Error booking installation:', error);
      toast.error('Failed to book installation');
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
                                  Available: {new Date(suggestion.availableDate).toLocaleDateString()}
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