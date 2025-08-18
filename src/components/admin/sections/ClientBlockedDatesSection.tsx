import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

interface ClientBlockedDatesSectionProps {
  clientId: string;
  onDataChange?: () => void;
}

export function ClientBlockedDatesSection({ clientId, onDataChange }: ClientBlockedDatesSectionProps) {
  const { toast } = useToast();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isRange, setIsRange] = useState(false);

  useEffect(() => {
    fetchBlockedDates();
  }, [clientId]);

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('client_blocked_dates')
        .select('*')
        .eq('client_id', clientId)
        .order('blocked_date', { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error) {
      console.error('Error fetching blocked dates:', error);
      toast({
        title: "Error",
        description: "Failed to load blocked dates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDate = async () => {
    if (!newDate.trim()) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    if (isRange && !endDate.trim()) {
      toast({
        title: "Error",
        description: "Please select an end date for the range",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const datesToInsert: any[] = [];
      const startDate = new Date(newDate);

      if (isRange && endDate) {
        const end = new Date(endDate);
        if (end < startDate) {
          toast({
            title: "Error",
            description: "End date must be after start date",
            variant: "destructive",
          });
          return;
        }

        // Add all dates in the range
        const current = new Date(startDate);
        while (current <= end) {
          datesToInsert.push({
            client_id: clientId,
            blocked_date: current.toISOString().split('T')[0],
            reason: reason.trim() || null,
          });
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Single date
        datesToInsert.push({
          client_id: clientId,
          blocked_date: startDate.toISOString().split('T')[0],
          reason: reason.trim() || null,
        });
      }

      const { error } = await supabase
        .from('client_blocked_dates')
        .insert(datesToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${datesToInsert.length} date(s) blocked successfully`,
      });

      // Reset form
      setNewDate('');
      setEndDate('');
      setReason('');
      setIsRange(false);
      
      // Refresh data
      fetchBlockedDates();
      onDataChange?.();
    } catch (error) {
      console.error('Error adding blocked date:', error);
      toast({
        title: "Error",
        description: "Failed to add blocked date",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDate = async (dateId: string) => {
    try {
      const { error } = await supabase
        .from('client_blocked_dates')
        .delete()
        .eq('id', dateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Blocked date removed successfully",
      });

      fetchBlockedDates();
      onDataChange?.();
    } catch (error) {
      console.error('Error removing blocked date:', error);
      toast({
        title: "Error",
        description: "Failed to remove blocked date",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Client Blocked Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-pulse">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Client Blocked Dates
        </CardTitle>
        <CardDescription>
          Manage dates when this client is not available for installations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Date Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
          <h4 className="font-medium">Block New Date(s)</h4>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRange"
              checked={isRange}
              onChange={(e) => setIsRange(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isRange" className="text-sm">Block date range</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newDate">
                {isRange ? 'Start Date' : 'Date'}
              </Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            {isRange && (
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={newDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Client on holiday, Property access restricted..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <Button 
            onClick={handleAddDate} 
            disabled={adding || !newDate}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {adding ? 'Adding...' : `Block ${isRange ? 'Date Range' : 'Date'}`}
          </Button>
        </div>

        {/* Existing Blocked Dates */}
        <div>
          <h4 className="font-medium mb-3">
            Blocked Dates ({blockedDates.length})
          </h4>
          
          {blockedDates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No blocked dates found for this client
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {blockedDates.map((blockedDate) => (
                <div
                  key={blockedDate.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {format(parseISO(blockedDate.blocked_date), 'PPP')}
                    </div>
                    {blockedDate.reason && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {blockedDate.reason}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Added {format(parseISO(blockedDate.created_at), 'PPp')}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveDate(blockedDate.id)}
                    className="ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
