import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export function usePermissions() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      console.log('usePermissions: Starting fetch', { userId: user?.id, role, roleLoading });
      
      if (roleLoading) {
        console.log('usePermissions: Role still loading, waiting...');
        return;
      }
      
      if (!user?.id || !role) {
        console.log('usePermissions: Missing user or role', { userId: user?.id, role });
        setPermissions({});
        setLoading(false);
        return;
      }

      console.log('usePermissions: Fetching permissions for role:', role);

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('permission_key, can_access')
          .eq('role', role);

        if (error) throw error;

        console.log('usePermissions: Raw permissions data:', data);

        const permissionsMap = data.reduce((acc, permission) => {
          acc[permission.permission_key] = permission.can_access;
          return acc;
        }, {} as Record<string, boolean>);

        console.log('usePermissions: Processed permissions:', permissionsMap);
        setPermissions(permissionsMap);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id, role, roleLoading]);

  const hasPermission = (permissionKey: string): boolean => {
    return permissions[permissionKey] === true;
  };

  const canManageUsers = hasPermission('users.manage');
  const canCreateUsers = hasPermission('users.create');
  const canDeleteUsers = hasPermission('users.delete');
  const canManageQuotes = hasPermission('quotes.manage');
  const canManageOrders = hasPermission('orders.manage');
  const canManageClients = hasPermission('clients.manage');
  const canManageMessages = hasPermission('messages.manage');
  const canManageEngineers = hasPermission('engineers.manage');
  const canManageSettings = hasPermission('settings.manage');
  const canViewFinancialReports = hasPermission('reports.financial');

  return {
    permissions,
    loading,
    hasPermission,
    canManageUsers,
    canCreateUsers,
    canDeleteUsers,
    canManageQuotes,
    canManageOrders,
    canManageClients,
    canManageMessages,
    canManageEngineers,
    canManageSettings,
    canViewFinancialReports,
  };
}