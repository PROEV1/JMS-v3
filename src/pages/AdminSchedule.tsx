import React, { useEffect, useState } from 'react';
import { AdminScheduleCalendar } from '@/components/scheduling/AdminScheduleCalendar';
import { EnhancedSchedulePipeline } from '@/components/scheduling/EnhancedSchedulePipeline';
import { SchedulingSettingsPanel } from '@/components/admin/SchedulingSettingsPanel';
import { SchedulingHub } from '@/components/scheduling/SchedulingHub';
import { useUserRole } from '@/hooks/useUserRole';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSchedule() {
  const { role: userRole, loading } = useUserRole();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hub');

  useEffect(() => {
    // Check for tab in URL params or navigation state
    const tabFromUrl = searchParams.get('tab');
    const tabFromState = location.state?.tab;
    
    if (tabFromUrl && ['hub', 'calendar', 'pipeline', 'settings'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (tabFromState && ['hub', 'calendar', 'pipeline', 'settings'].includes(tabFromState)) {
      setActiveTab(tabFromState);
    }
  }, [searchParams, location.state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          You don't have permission to access the scheduling system.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hub">Scheduling Hub</TabsTrigger>
          <TabsTrigger value="calendar">Schedule Calendar</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="hub" className="mt-6">
          <SchedulingHub />
        </TabsContent>
        <TabsContent value="calendar" className="mt-6">
          <AdminScheduleCalendar />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-6">
          <EnhancedSchedulePipeline />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SchedulingSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}