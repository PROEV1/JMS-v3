import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarX, Plus, Trash2 } from 'lucide-react';

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason?: string;
}

export function ClientDateBlocker() {
  const { user } = useAuth();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Get client ID for current user
  useEffect(() => {
    const getClientId = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error getting client ID:', error);
        return;
      }
      
      setClientId(data.id);
    };
    
    getClientId();
  }, [user]);

  // Load blocked dates
  useEffect(() => {
    const loadBlockedDates = async () => {
      if (!clientId) return;
      
      const { data, error } = await supabase
        .from('client_blocked_dates')
        .select('*')
        .eq('client_id', clientId)
        .order('blocked_date', { ascending: true });
      
      if (error) {
        console.error('Error loading blocked dates:', error);
        toast.error('Failed to load blocked dates');
        return;
      }
      
      setBlockedDates(data || []);
    };
    
    if (clientId) {
      loadBlockedDates();
    }
  }, [clientId]);

  const handleAddBlockedDate = async () => {
    if (!selectedDate || !clientId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('client_blocked_dates')
        .insert({
          client_id: clientId,
          blocked_date: selectedDate.toISOString().split('T')[0],
          reason: reason.trim() || null
        });
      
      if (error) throw error;
      
      // Reload blocked dates
      const { data } = await supabase
        .from('client_blocked_dates')
        .select('*')
        .eq('client_id', clientId)
        .order('blocked_date', { ascending: true });
      
      setBlockedDates(data || []);
      setSelectedDate(undefined);
      setReason('');
      toast.success('Date blocked successfully');
    } catch (error) {
      console.error('Error blocking date:', error);
      toast.error('Failed to block date');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_blocked_dates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setBlockedDates(prev => prev.filter(date => date.id !== id));
      toast.success('Blocked date removed');
    } catch (error) {
      console.error('Error removing blocked date:', error);
      toast.error('Failed to remove blocked date');
    }
  };

  const isDateBlocked = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(blocked => blocked.blocked_date === dateStr);
  };

  const getBlockedDatesForCalendar = () => {
    return blockedDates.map(date => new Date(date.blocked_date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CalendarX className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Blocked Dates</h2>
      </div>
      
      <p className="text-muted-foreground">
        Block dates when you're not available for installations. This helps our scheduling team 
        avoid booking jobs when you're away.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar for selecting dates to block */}
        <Card>
          <CardHeader>
            <CardTitle>Block New Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || isDateBlocked(date)}
              modifiers={{
                blocked: getBlockedDatesForCalendar()
              }}
              modifiersStyles={{
                blocked: { backgroundColor: 'hsl(var(--destructive))', color: 'white' }
              }}
              className="rounded-md border"
            />
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Holiday, Out of town..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            
            <Button
              onClick={handleAddBlockedDate}
              disabled={!selectedDate || loading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Block Selected Date
            </Button>
          </CardContent>
        </Card>

        {/* List of currently blocked dates */}
        <Card>
          <CardHeader>
            <CardTitle>
              Currently Blocked Dates
              <Badge variant="secondary" className="ml-2">
                {blockedDates.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {blockedDates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No blocked dates</p>
                <p className="text-sm">Select dates on the calendar to block them</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {blockedDates.map((blockedDate) => (
                  <div
                    key={blockedDate.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">
                        {new Date(blockedDate.blocked_date).toLocaleDateString('en-GB', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      {blockedDate.reason && (
                        <div className="text-sm text-muted-foreground">
                          {blockedDate.reason}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBlockedDate(blockedDate.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}