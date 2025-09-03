import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Settings, User, MapPin, Calendar, CheckCircle, XCircle, Clock, Upload, Trash2, Sliders } from 'lucide-react';
import { EngineerScheduleManager } from '@/components/admin/EngineerScheduleManager';
import { EngineerUserSetup } from '@/components/admin/EngineerUserSetup';
import { EngineerCsvImport } from '@/components/admin/EngineerCsvImport';
import { SubcontractorSettingsPanel } from '@/components/admin/SubcontractorSettingsPanel';
import { useNavigate } from 'react-router-dom';

interface Engineer {
  id: string;
  name: string;
  email: string;
  region: string | null;
  availability: boolean;
  is_subcontractor: boolean;
  ignore_working_hours: boolean;
  max_installs_per_day: number;
  created_at: string;
  user_id: string | null;
  assigned_jobs: number;
  completed_jobs: number;
  scheduled_today: number;
  starting_postcode: string | null;
  service_areas?: Array<{
    postcode_area: string;
    max_travel_minutes: number;
  }>;
}

export default function AdminEngineers() {
  const navigate = useNavigate();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [filteredEngineers, setFilteredEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showScheduleManager, setShowScheduleManager] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);
  const [showUserSetup, setShowUserSetup] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'employees' | 'subcontractors'>('all');
  const [subcontractorSettings, setSubcontractorSettings] = useState({ enabled: false, alert_threshold_percent: 80 });
  const [showSubcontractorSettings, setShowSubcontractorSettings] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    region: '',
    availability: true,
    is_subcontractor: false,
    ignore_working_hours: false,
    max_installs_per_day: 3,
    user_id: null as string | null
  });
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    fetchEngineers();
    fetchAvailableUsers();
    fetchSubcontractorSettings();
  }, []);

  useEffect(() => {
    // Filter engineers based on selected filter
    let filtered = engineers;
    if (filterType === 'employees') {
      filtered = engineers.filter(e => !e.is_subcontractor);
    } else if (filterType === 'subcontractors') {
      filtered = engineers.filter(e => e.is_subcontractor);
    }
    setFilteredEngineers(filtered);
  }, [engineers, filterType]);

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'engineer')
        .eq('status', 'active');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const fetchSubcontractorSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'subcontractor_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subcontractor settings:', error);
      } else if (data) {
        setSubcontractorSettings(data.setting_value as any);
      }
    } catch (error) {
      console.error('Error fetching subcontractor settings:', error);
    }
  };

  const fetchEngineers = async () => {
    try {
      // Fetch engineers with job counts
      const { data: engineersData, error: engineersError } = await supabase
        .from('engineers')
        .select('*')
        .order('created_at', { ascending: false });

      if (engineersError) throw engineersError;

      // Get today's date for scheduled jobs
      const today = new Date().toISOString().split('T')[0];

      // Fetch job counts and service areas for each engineer
      const engineersWithCounts = await Promise.all(
        engineersData.map(async (engineer) => {
          const [jobsResult, scheduledTodayResult, serviceAreasResult] = await Promise.all([
            supabase
              .from('orders')
              .select('id, engineer_signed_off_at')
              .eq('engineer_id', engineer.id),
            supabase
              .from('orders')
              .select('id')
              .eq('engineer_id', engineer.id)
              .eq('scheduled_install_date', today)
              .not('status_enhanced', 'eq', 'completed'),
            supabase
              .from('engineer_service_areas')
              .select('postcode_area, max_travel_minutes')
              .eq('engineer_id', engineer.id)
          ]);

          if (jobsResult.error) {
            console.error('Error fetching assigned jobs:', jobsResult.error);
          }

          const assigned = jobsResult.data?.length || 0;
          const completed = jobsResult.data?.filter(job => job.engineer_signed_off_at).length || 0;
          const scheduledToday = scheduledTodayResult.data?.length || 0;

          return {
            ...engineer,
            assigned_jobs: assigned,
            completed_jobs: completed,
            scheduled_today: scheduledToday,
            service_areas: serviceAreasResult.data || []
          };
        })
      );

      setEngineers(engineersWithCounts);
    } catch (error) {
      console.error('Error fetching engineers:', error);
      toast({
        title: "Error",
        description: "Failed to load engineers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingEngineer) {
        // Update existing engineer
        const { error } = await supabase
          .from('engineers')
          .update({
            name: formData.name,
            email: formData.email,
            region: formData.region || null,
            availability: formData.availability,
            is_subcontractor: formData.is_subcontractor,
            ignore_working_hours: formData.ignore_working_hours,
            max_installs_per_day: formData.max_installs_per_day,
            user_id: formData.user_id
          })
          .eq('id', editingEngineer.id);

        if (error) throw error;

        toast({
          title: "Engineer Updated",
          description: "Engineer details have been updated successfully",
        });
      } else {
        // Create new engineer
        const { error } = await supabase
          .from('engineers')
          .insert({
            name: formData.name,
            email: formData.email,
            region: formData.region || null,
            availability: formData.availability,
            is_subcontractor: formData.is_subcontractor,
            ignore_working_hours: formData.ignore_working_hours,
            max_installs_per_day: formData.max_installs_per_day,
            user_id: formData.user_id
          });

        if (error) throw error;

        toast({
          title: "Engineer Created",
          description: "New engineer has been added successfully",
        });
      }

      resetForm();
      fetchEngineers();
    } catch (error: any) {
      console.error('Error saving engineer:', error);
      
      if (error.code === '23505') {
        toast({
          title: "Email Already Exists",
          description: "An engineer with this email already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save engineer. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      region: '',
      availability: true,
      is_subcontractor: false,
      ignore_working_hours: false,
      max_installs_per_day: 3,
      user_id: null
    });
    setEditingEngineer(null);
    setShowCreateModal(false);
  };

  const handleEdit = (engineer: Engineer) => {
    setFormData({
      name: engineer.name,
      email: engineer.email,
      region: engineer.region || '',
      availability: engineer.availability,
      is_subcontractor: engineer.is_subcontractor,
      ignore_working_hours: engineer.ignore_working_hours,
      max_installs_per_day: engineer.max_installs_per_day,
      user_id: engineer.user_id
    });
    setEditingEngineer(engineer);
    setShowCreateModal(true);
  };

  const syncServiceAreas = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-engineer-service-areas');
      
      if (error) throw error;
      
      toast({
        title: "Service Areas Synced",
        description: `Created ${data.created_areas} service areas for ${data.updated_engineers} engineers`,
      });
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Sync warnings:', data.errors);
        toast({
          title: "Sync Completed with Warnings",
          description: `${data.errors.length} engineers had issues. Check console for details.`,
          variant: "destructive",
        });
      }
      
      fetchEngineers();
    } catch (error: any) {
      console.error('Error syncing service areas:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync service areas",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAvailability = async (engineer: Engineer) => {
    try {
      const { error } = await supabase
        .from('engineers')
        .update({ availability: !engineer.availability })
        .eq('id', engineer.id);

      if (error) throw error;

      toast({
        title: "Availability Updated",
        description: `${engineer.name} is now ${!engineer.availability ? 'available' : 'unavailable'}`,
      });

      fetchEngineers();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (engineer: Engineer) => {
    // Check if engineer has active assignments
    if (engineer.assigned_jobs > engineer.completed_jobs) {
      toast({
        title: "Cannot Delete Engineer",
        description: `${engineer.name} has ${engineer.assigned_jobs - engineer.completed_jobs} active job assignments. Please reassign or complete these jobs first.`,
        variant: "destructive",
      });
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${engineer.name}?\n\n` +
      `This will permanently remove:\n` +
      `• Engineer profile\n` +
      `• Availability settings\n` +
      `• Service areas\n` +
      `• Time off records\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      // Delete related data first, then engineer
      const { error: availabilityError } = await supabase
        .from('engineer_availability')
        .delete()
        .eq('engineer_id', engineer.id);

      if (availabilityError) throw availabilityError;

      const { error: serviceAreasError } = await supabase
        .from('engineer_service_areas')
        .delete()
        .eq('engineer_id', engineer.id);

      if (serviceAreasError) throw serviceAreasError;

      const { error: timeOffError } = await supabase
        .from('engineer_time_off')
        .delete()
        .eq('engineer_id', engineer.id);

      if (timeOffError) throw timeOffError;

      // Finally delete the engineer
      const { error: engineerError } = await supabase
        .from('engineers')
        .delete()
        .eq('id', engineer.id);

      if (engineerError) throw engineerError;

      toast({
        title: "Engineer Deleted",
        description: `${engineer.name} has been permanently removed from the system`,
      });

      fetchEngineers();
    } catch (error: any) {
      console.error('Error deleting engineer:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete engineer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <BrandLoading />;

  return (
    <BrandPage>
      <BrandContainer>
        <div className="flex items-center justify-between mb-8">
          <div>
            <BrandHeading1>Engineer Management</BrandHeading1>
            {subcontractorSettings.enabled && (
              <p className="text-muted-foreground mt-1">
                Managing {filteredEngineers.filter(e => !e.is_subcontractor).length} employees and {filteredEngineers.filter(e => e.is_subcontractor).length} subcontractors
              </p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={syncServiceAreas} disabled={syncing}>
              <MapPin className="h-4 w-4 mr-2" />
              {syncing ? 'Syncing...' : 'Sync Service Areas'}
            </Button>
            
            <Button variant="outline" onClick={() => setShowCsvImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>

            <Button variant="outline" onClick={() => setShowSubcontractorSettings(true)}>
              <Sliders className="h-4 w-4 mr-2" />
              Settings
            </Button>
            
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingEngineer(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Engineer
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEngineer ? 'Edit Engineer' : 'Add New Engineer'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                
                 <div>
                   <Label htmlFor="region">Region</Label>
                   <Input
                     id="region"
                     value={formData.region}
                     onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                     placeholder="Enter region (optional)"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="user_id">Link to User Account</Label>
                   <select
                     id="user_id"
                     value={formData.user_id || ''}
                     onChange={(e) => setFormData({ ...formData, user_id: e.target.value || null })}
                     className="w-full px-3 py-2 border border-input rounded-md"
                   >
                     <option value="">Select user account (optional)</option>
                      {availableUsers.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                   </select>
                 </div>
                
                 <div className="flex items-center space-x-2">
                   <input
                     type="checkbox"
                     id="availability"
                     checked={formData.availability}
                     onChange={(e) => setFormData({ ...formData, availability: e.target.checked })}
                     className="rounded"
                   />
                   <Label htmlFor="availability">Available for assignments</Label>
                 </div>

                 {/* Subcontractor Settings */}
                 {subcontractorSettings.enabled && (
                   <div className="space-y-4 border-t pt-4">
                     <h4 className="font-medium text-sm">Subcontractor Settings</h4>
                     
                     <div className="flex items-center space-x-2">
                       <input
                         type="checkbox"
                         id="is_subcontractor"
                         checked={formData.is_subcontractor}
                         onChange={(e) => setFormData({ ...formData, is_subcontractor: e.target.checked })}
                         className="rounded"
                       />
                       <Label htmlFor="is_subcontractor">This is a subcontractor</Label>
                     </div>

                     <div>
                       <Label htmlFor="max_installs_per_day">Max Jobs per Day</Label>
                       <Input
                         id="max_installs_per_day"
                         type="number"
                         min="1"
                         max="20"
                         value={formData.max_installs_per_day}
                         onChange={(e) => setFormData({ ...formData, max_installs_per_day: parseInt(e.target.value) || 3 })}
                         placeholder="Maximum jobs per day"
                       />
                     </div>

                     <div className="flex items-center space-x-2">
                       <input
                         type="checkbox"
                         id="ignore_working_hours"
                         checked={formData.ignore_working_hours}
                         onChange={(e) => setFormData({ ...formData, ignore_working_hours: e.target.checked })}
                         className="rounded"
                       />
                       <Label htmlFor="ignore_working_hours">Can work outside standard hours</Label>
                     </div>
                   </div>
                 )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingEngineer ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filter Controls */}
        {subcontractorSettings.enabled && (
          <div className="flex items-center gap-4 mb-6">
            <Label>Filter by Type:</Label>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                All ({engineers.length})
              </Button>
              <Button
                variant={filterType === 'employees' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('employees')}
              >
                Employees ({engineers.filter(e => !e.is_subcontractor).length})
              </Button>
              <Button
                variant={filterType === 'subcontractors' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('subcontractors')}
              >
                Subcontractors ({engineers.filter(e => e.is_subcontractor).length})
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Engineers</p>
                  <p className="text-2xl font-bold">{filteredEngineers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {subcontractorSettings.enabled && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-2xl font-bold">{filteredEngineers.filter(e => !e.is_subcontractor).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Subcontractors</p>
                      <p className="text-2xl font-bold">{filteredEngineers.filter(e => e.is_subcontractor).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">
                    {filteredEngineers.filter(e => e.availability).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold">
                    {filteredEngineers.reduce((sum, e) => sum + (e.assigned_jobs - e.completed_jobs), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engineers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Engineers</CardTitle>
          </CardHeader>
          <CardContent>
            {engineers.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No engineers added yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowCreateModal(true)}
                >
                  Add Your First Engineer
                </Button>
              </div>
            ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Engineer</TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Region</TableHead>
                       <TableHead>Starting Postcode</TableHead>
                       <TableHead>Service Areas</TableHead>
                       <TableHead>Status</TableHead>
                       {subcontractorSettings.enabled && <TableHead>Today's Utilization</TableHead>}
                       <TableHead>Jobs Assigned</TableHead>
                       <TableHead>Jobs Completed</TableHead>
                       <TableHead>User Account</TableHead>
                       <TableHead className="text-center">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredEngineers.map((engineer) => (
                       <TableRow key={engineer.id}>
                         <TableCell>
                           <div>
                             <div className="font-medium">{engineer.name}</div>
                             <div className="text-sm text-muted-foreground">{engineer.email}</div>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="space-y-1">
                             <Badge 
                               variant={engineer.is_subcontractor ? "secondary" : "default"}
                               className={engineer.is_subcontractor ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}
                             >
                               {engineer.is_subcontractor ? 'Subcontractor' : 'Employee'}
                             </Badge>
                             {engineer.is_subcontractor && (
                               <div className="text-xs text-muted-foreground">
                                 Max: {engineer.max_installs_per_day}/day
                                 {engineer.ignore_working_hours && <div>24/7 Available</div>}
                               </div>
                             )}
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center space-x-1">
                             <MapPin className="h-3 w-3 text-muted-foreground" />
                             <span>{engineer.region || 'Not set'}</span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center space-x-1">
                             <MapPin className="h-3 w-3 text-muted-foreground" />
                             <span className="text-sm font-mono">{engineer.starting_postcode || 'Not set'}</span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="space-y-1">
                             {engineer.service_areas && engineer.service_areas.length > 0 ? (
                               engineer.service_areas.map((area, index) => (
                                 <div key={index} className="text-xs">
                                   <span className="font-mono">{area.postcode_area}</span>
                                   <span className="text-muted-foreground ml-1">({area.max_travel_minutes}min)</span>
                                 </div>
                               ))
                             ) : (
                               <span className="text-xs text-muted-foreground">No areas set</span>
                             )}
                           </div>
                         </TableCell>
                         <TableCell>
                           <Badge 
                             variant={engineer.availability ? "default" : "secondary"}
                             className={engineer.availability ? "bg-green-100 text-green-800" : ""}
                           >
                             {engineer.availability ? 'Available' : 'Unavailable'}
                           </Badge>
                         </TableCell>
                         {subcontractorSettings.enabled && (
                           <TableCell>
                             <div className="space-y-1">
                               <div className="text-sm font-medium">
                                 {engineer.scheduled_today}/{engineer.max_installs_per_day} jobs
                               </div>
                               <div className="w-full bg-gray-200 rounded-full h-2">
                                 <div 
                                   className={`h-2 rounded-full ${
                                     engineer.scheduled_today / engineer.max_installs_per_day >= (subcontractorSettings.alert_threshold_percent / 100) 
                                       ? 'bg-red-500' 
                                       : engineer.scheduled_today / engineer.max_installs_per_day >= 0.5 
                                         ? 'bg-yellow-500' 
                                         : 'bg-green-500'
                                   }`}
                                   style={{ 
                                     width: `${Math.min((engineer.scheduled_today / engineer.max_installs_per_day) * 100, 100)}%` 
                                   }}
                                 />
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {Math.round((engineer.scheduled_today / engineer.max_installs_per_day) * 100)}% utilized
                               </div>
                             </div>
                           </TableCell>
                         )}
                         <TableCell>
                           <div className="font-medium">{engineer.assigned_jobs}</div>
                         </TableCell>
                         <TableCell>
                           <div className="font-medium">{engineer.completed_jobs}</div>
                         </TableCell>
                         <TableCell>
                           {engineer.user_id ? (
                             <Badge className="bg-green-100 text-green-800">
                               <CheckCircle className="h-3 w-3 mr-1" />
                               Active
                             </Badge>
                           ) : (
                             <Badge variant="secondary">
                               No Account
                             </Badge>
                           )}
                         </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(engineer)}
                            title="Edit Engineer Details"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEngineer(engineer);
                              setShowScheduleManager(true);
                            }}
                            title="Schedule Management"
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEngineer(engineer);
                              setShowUserSetup(true);
                            }}
                            title="User Account Setup"
                          >
                            <User className="h-3 w-3" />
                          </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleToggleAvailability(engineer)}
                             title={engineer.availability ? "Mark Unavailable" : "Mark Available"}
                           >
                             {engineer.availability ? (
                               <XCircle className="h-3 w-3" />
                             ) : (
                               <CheckCircle className="h-3 w-3" />
                             )}
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleDelete(engineer)}
                             title="Delete Engineer"
                             className="text-red-600 hover:text-red-700 hover:bg-red-50"
                             disabled={saving}
                           >
                             <Trash2 className="h-3 w-3" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Schedule Manager Modal */}
        {showScheduleManager && selectedEngineer && (
          <Dialog open={showScheduleManager} onOpenChange={setShowScheduleManager}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Engineer Schedule Management</DialogTitle>
              </DialogHeader>
              <EngineerScheduleManager 
                engineerId={selectedEngineer.id}
                engineerName={selectedEngineer.name}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* User Setup Modal */}
        {showUserSetup && selectedEngineer && (
          <Dialog open={showUserSetup} onOpenChange={setShowUserSetup}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Engineer User Account Setup</DialogTitle>
              </DialogHeader>
              <EngineerUserSetup 
                engineer={selectedEngineer}
                onUpdate={() => {
                  fetchEngineers();
                  setShowUserSetup(false);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* CSV Import Modal */}
        <EngineerCsvImport 
          open={showCsvImport}
          onOpenChange={setShowCsvImport}
          onImportComplete={() => {
            fetchEngineers();
            setShowCsvImport(false);
          }}
        />

        {/* Subcontractor Settings Modal */}
        {showSubcontractorSettings && (
          <Dialog open={showSubcontractorSettings} onOpenChange={setShowSubcontractorSettings}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Subcontractor Settings</DialogTitle>
              </DialogHeader>
              <SubcontractorSettingsPanel 
                onSettingsChange={(newSettings) => {
                  setSubcontractorSettings(newSettings);
                  setShowSubcontractorSettings(false);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </BrandContainer>
    </BrandPage>
  );
}