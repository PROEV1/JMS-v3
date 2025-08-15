import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { Clock, MapPin, Plus, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface WorkingHours {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function EngineerAvailabilityManager() {
  const { user } = useAuth();
  const [engineer, setEngineer] = useState<any>(null);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [startingPostcode, setStartingPostcode] = useState('');
  
  // Time off form
  const [timeOffForm, setTimeOffForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    notes: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEngineerData();
    }
  }, [user]);

  const fetchEngineerData = async () => {
    try {
      // Get engineer profile
      const { data: engineerData, error: engineerError } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (engineerError) throw engineerError;
      setEngineer(engineerData);
      setStartingPostcode(engineerData.starting_postcode || '');

      // Fetch time off requests
      const { data: timeOffData, error: timeOffError } = await supabase
        .from('engineer_time_off')
        .select('*')
        .eq('engineer_id', engineerData.id)
        .order('start_date', { ascending: true });

      if (timeOffError) throw timeOffError;
      setTimeOffRequests(timeOffData || []);

      // Fetch working hours
      const { data: workingHoursData, error: workingHoursError } = await supabase
        .from('engineer_availability')
        .select('*')
        .eq('engineer_id', engineerData.id)
        .order('day_of_week');

      if (workingHoursError) throw workingHoursError;
      setWorkingHours(workingHoursData || []);

    } catch (error) {
      console.error('Error fetching engineer data:', error);
      toast({
        title: "Error",
        description: "Failed to load availability data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStartingPostcode = async () => {
    try {
      const { error } = await supabase
        .from('engineers')
        .update({ starting_postcode: startingPostcode })
        .eq('id', engineer.id);

      if (error) throw error;

      toast({
        title: "Starting Location Updated",
        description: "Your starting location has been updated",
      });
    } catch (error) {
      console.error('Error updating starting postcode:', error);
      toast({
        title: "Error",
        description: "Failed to update starting location",
        variant: "destructive",
      });
    }
  };

  const requestTimeOff = async () => {
    try {
      const { error } = await supabase
        .from('engineer_time_off')
        .insert({
          engineer_id: engineer.id,
          start_date: timeOffForm.start_date,
          end_date: timeOffForm.end_date,
          reason: timeOffForm.reason,
          notes: timeOffForm.notes,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Time Off Requested",
        description: "Your time off request has been submitted for approval",
      });

      setTimeOffForm({ start_date: '', end_date: '', reason: '', notes: '' });
      setShowTimeOffModal(false);
      fetchEngineerData();
    } catch (error) {
      console.error('Error requesting time off:', error);
      toast({
        title: "Error",
        description: "Failed to submit time off request",
        variant: "destructive",
      });
    }
  };

  const updateWorkingHours = async (dayOfWeek: number, field: string, value: any) => {
    try {
      const existingHours = workingHours.find(wh => wh.day_of_week === dayOfWeek);
      
      if (existingHours) {
        const { error } = await supabase
          .from('engineer_availability')
          .update({ [field]: value })
          .eq('id', existingHours.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('engineer_availability')
          .insert({
            engineer_id: engineer.id,
            day_of_week: dayOfWeek,
            start_time: field === 'start_time' ? value : '09:00',
            end_time: field === 'end_time' ? value : '17:00',
            is_available: field === 'is_available' ? value : true
          });

        if (error) throw error;
      }

      fetchEngineerData();
    } catch (error) {
      console.error('Error updating working hours:', error);
      toast({
        title: "Error",
        description: "Failed to update working hours",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading availability settings...</div>;
  }

  if (!engineer) {
    return <div>Engineer profile not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Availability</h2>
        <p className="text-muted-foreground">Manage your working hours and time off requests</p>
      </div>

      {/* Starting Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Starting Location</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="startingPostcode">Starting Postcode</Label>
              <Input
                id="startingPostcode"
                value={startingPostcode}
                onChange={(e) => setStartingPostcode(e.target.value)}
                placeholder="e.g., SW1A 1AA"
              />
            </div>
            <Button onClick={updateStartingPostcode}>Update</Button>
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Working Hours</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS.map((day, index) => {
              const dayHours = workingHours.find(wh => wh.day_of_week === index);
              return (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-24 font-medium">{day}</div>
                  <Switch
                    checked={dayHours?.is_available ?? false}
                    onCheckedChange={(checked) => updateWorkingHours(index, 'is_available', checked)}
                  />
                  {dayHours?.is_available && (
                    <>
                      <Input
                        type="time"
                        value={dayHours?.start_time || '09:00'}
                        onChange={(e) => updateWorkingHours(index, 'start_time', e.target.value)}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={dayHours?.end_time || '17:00'}
                        onChange={(e) => updateWorkingHours(index, 'end_time', e.target.value)}
                        className="w-32"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time Off Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Time Off Requests</span>
            </div>
            <Dialog open={showTimeOffModal} onOpenChange={setShowTimeOffModal}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Request Time Off
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Time Off</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={timeOffForm.start_date}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={timeOffForm.end_date}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Select 
                      value={timeOffForm.reason} 
                      onValueChange={(value) => setTimeOffForm(prev => ({ ...prev, reason: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="sick_leave">Sick Leave</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={timeOffForm.notes}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional details..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowTimeOffModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={requestTimeOff}>Submit Request</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeOffRequests.length === 0 ? (
            <p className="text-muted-foreground">No time off requests</p>
          ) : (
            <div className="space-y-3">
              {timeOffRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">
                      {format(new Date(request.start_date), 'MMM d, yyyy')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {request.reason.replace('_', ' ')}
                      {request.notes && ` - ${request.notes}`}
                    </div>
                  </div>
                  <Badge variant={
                    request.status === 'approved' ? 'default' : 
                    request.status === 'pending' ? 'secondary' : 
                    'destructive'
                  }>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}