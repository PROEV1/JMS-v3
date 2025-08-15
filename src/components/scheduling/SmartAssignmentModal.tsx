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
import { Calendar } from '@/components/ui/calendar';
import { Order, Engineer, getSmartEngineerRecommendations } from '@/utils/schedulingUtils';
import { MapPin, Clock, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SmartAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  engineers: Engineer[];
  onAssign: (engineerId: string, date: string) => Promise<void>;
}

interface EngineerSuggestion {
  engineer: Engineer;
  availableDate?: string;
  distance: number;
  travelTime: number;
  score: number;
  reasons: string[];
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

  // Load smart suggestions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const result = await getSmartEngineerRecommendations(order, engineers);
        setSuggestions(result.recommendations);
        
        // Auto-select the first available date if no date is selected
        if (!selectedDate && result.recommendations.length > 0 && result.recommendations[0].availableDate) {
          setSelectedDate(new Date(result.recommendations[0].availableDate));
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

  const handleAssign = async () => {
    if (!selectedEngineerId || !selectedDate) {
      toast.error('Please select both an engineer and date');
      return;
    }

    try {
      await onAssign(selectedEngineerId, selectedDate.toISOString());
      onClose();
    } catch (error) {
      toast.error('Failed to assign job');
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
                  <strong>Duration:</strong> {order.estimated_duration_hours || 2} hours
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Date Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Date</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            {/* Engineer Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Engineer Suggestions
                  {selectedDate && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      for {selectedDate.toLocaleDateString()}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Calculating suggestions...</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Select a date to see engineer suggestions
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                        <Card
                        key={suggestion.engineer.id}
                        className={`
                          cursor-pointer transition-all duration-200 hover:shadow-md
                          ${selectedEngineerId === suggestion.engineer.id ? 'ring-2 ring-primary' : ''}
                        `}
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
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={!selectedEngineerId || !selectedDate}
            >
              Assign Job
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}