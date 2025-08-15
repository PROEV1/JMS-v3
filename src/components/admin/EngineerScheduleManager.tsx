import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
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

interface EngineerScheduleManagerProps {
  engineerId: string;
  engineerName: string;
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface ServiceArea {
  id: string;
  postcode_area: string;
  max_travel_minutes: number;
}

interface WorkingHours {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function EngineerScheduleManager({ engineerId, engineerName }: EngineerScheduleManagerProps) {
  const [engineer, setEngineer] = useState<any>(null);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showServiceAreaModal, setShowServiceAreaModal] = useState(false);
  const [startingPostcode, setStartingPostcode] = useState('');
  
  // Time off form
  const [timeOffForm, setTimeOffForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    notes: ''
  });
  
  // Service area form
  const [serviceAreaForm, setServiceAreaForm] = useState({
    postcode_area: '',
    max_travel_minutes: 60
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchEngineerData();
  }, [engineerId]);

  const fetchEngineerData = async () => {
    try {
      // Fetch engineer details
      const { data: engineerData, error: engineerError } = await supabase
        .from('engineers')
        .select('*')
        .eq('id', engineerId)
        .single();

      if (engineerError) throw engineerError;
      setEngineer(engineerData);
      setStartingPostcode(engineerData.starting_postcode || '');

      // Fetch time off requests
      const { data: timeOffData, error: timeOffError } = await supabase
        .from('engineer_time_off')
        .select('*')
        .eq('engineer_id', engineerId)
        .order('start_date', { ascending: true });

      if (timeOffError) throw timeOffError;
      setTimeOffRequests(timeOffData || []);

      // Fetch service areas
      const { data: serviceAreasData, error: serviceAreasError } = await supabase
        .from('engineer_service_areas')
        .select('*')
        .eq('engineer_id', engineerId)
        .order('postcode_area');

      if (serviceAreasError) throw serviceAreasError;
      setServiceAreas(serviceAreasData || []);

      // Fetch working hours
      const { data: workingHoursData, error: workingHoursError } = await supabase
        .from('engineer_availability')
        .select('*')
        .eq('engineer_id', engineerId)
        .order('day_of_week');

      if (workingHoursError) throw workingHoursError;
      setWorkingHours(workingHoursData || []);

    } catch (error) {
      console.error('Error fetching engineer data:', error);
      toast({
        title: "Error",
        description: "Failed to load engineer schedule data",
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
        .eq('id', engineerId);

      if (error) throw error;

      toast({
        title: "Starting Postcode Updated",
        description: "Engineer's starting location has been updated",
      });
    } catch (error) {
      console.error('Error updating starting postcode:', error);
      toast({
        title: "Error",
        description: "Failed to update starting postcode",
        variant: "destructive",
      });
    }
  };

  const createTimeOffRequest = async () => {
    try {
      const { error } = await supabase
        .from('engineer_time_off')
        .insert({
          engineer_id: engineerId,
          start_date: timeOffForm.start_date,
          end_date: timeOffForm.end_date,
          reason: timeOffForm.reason,
          notes: timeOffForm.notes,
          status: 'approved' // Admin can approve immediately
        });

      if (error) throw error;

      toast({
        title: "Time Off Added",
        description: "Time off request has been created and approved",
      });

      setTimeOffForm({ start_date: '', end_date: '', reason: '', notes: '' });
      setShowTimeOffModal(false);
      fetchEngineerData();
    } catch (error) {
      console.error('Error creating time off request:', error);
      toast({
        title: "Error",
        description: "Failed to create time off request",
        variant: "destructive",
      });
    }
  };

  const addServiceArea = async () => {
    try {
      const { error } = await supabase
        .from('engineer_service_areas')
        .insert({
          engineer_id: engineerId,
          postcode_area: serviceAreaForm.postcode_area,
          max_travel_minutes: serviceAreaForm.max_travel_minutes
        });

      if (error) throw error;

      toast({
        title: "Service Area Added",
        description: "New service area has been added",
      });

      setServiceAreaForm({ postcode_area: '', max_travel_minutes: 60 });
      setShowServiceAreaModal(false);
      fetchEngineerData();
    } catch (error) {
      console.error('Error adding service area:', error);
      toast({
        title: "Error",
        description: "Failed to add service area",
        variant: "destructive",
      });
    }
  };

  const deleteTimeOff = async (timeOffId: string) => {
    try {
      const { error } = await supabase
        .from('engineer_time_off')
        .delete()
        .eq('id', timeOffId);

      if (error) throw error;

      toast({
        title: "Time Off Removed",
        description: "Time off request has been deleted",
      });

      fetchEngineerData();
    } catch (error) {
      console.error('Error deleting time off:', error);
      toast({
        title: "Error",
        description: "Failed to delete time off request",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading engineer schedule...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule Management - {engineerName}</h2>
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

      {/* Service Areas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Service Areas</span>
            <Dialog open={showServiceAreaModal} onOpenChange={setShowServiceAreaModal}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Area
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Service Area</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="postcodeArea">Postcode Area</Label>
                    <Input
                      id="postcodeArea"
                      value={serviceAreaForm.postcode_area}
                      onChange={(e) => setServiceAreaForm(prev => ({ ...prev, postcode_area: e.target.value }))}
                      placeholder="e.g., SW1, E1, N1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxTravel">Max Travel Time (minutes)</Label>
                    <Input
                      id="maxTravel"
                      type="number"
                      value={serviceAreaForm.max_travel_minutes}
                      onChange={(e) => setServiceAreaForm(prev => ({ ...prev, max_travel_minutes: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowServiceAreaModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addServiceArea}>Add Area</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {serviceAreas.length === 0 ? (
            <p className="text-muted-foreground">No service areas defined</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceAreas.map((area) => (
                <div key={area.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{area.postcode_area}</div>
                    <div className="text-sm text-muted-foreground">
                      Max {area.max_travel_minutes} min travel
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Off Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Time Off & Holidays</span>
            <Dialog open={showTimeOffModal} onOpenChange={setShowTimeOffModal}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Off
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Time Off</DialogTitle>
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={timeOffForm.notes}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowTimeOffModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createTimeOffRequest}>Add Time Off</Button>
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
                  <div className="flex items-center space-x-2">
                    <Badge variant={request.status === 'approved' ? 'default' : 'secondary'}>
                      {request.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTimeOff(request.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}