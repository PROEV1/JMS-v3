
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Mail, User, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface PortalAccessPanelProps {
  client: {
    id: string;
    user_id?: string;
    email: string;
    full_name: string;
  };
}

interface UserProfile {
  email: string;
  full_name: string;
  role: string;
  status: string;
  last_login?: string;
}

export const PortalAccessPanel: React.FC<PortalAccessPanelProps> = ({ client }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUserProfile();
  }, [client.user_id]);

  const loadUserProfile = async () => {
    if (!client.user_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name, role, status, last_login')
        .eq('user_id', client.user_id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error in loadUserProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendUserInvite = async () => {
    try {
      setSending(true);
      console.log('Sending user invite for client:', client.id);

      const { data, error } = await supabase.functions.invoke('send-user-invite', {
        body: {
          email: client.email,
          full_name: client.full_name,
          role: 'client',
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send invite');
      }

      console.log('Invite sent successfully:', data);
      toast({
        title: "Success",
        description: profile ? 'Password reset link sent' : 'Portal invite sent',
      });
      
      // Reload profile data
      await loadUserProfile();
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : 'Failed to send invite',
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Portal Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPortalAccess = !!client.user_id && !!profile;
  const isActive = profile?.status === 'active';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPortalAccess ? (
          <>
            {/* Account Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account Status:</span>
              <Badge variant={isActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                {isActive ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {profile?.status || 'Unknown'}
              </Badge>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm text-muted-foreground">{profile?.email}</span>
            </div>

            {/* Role */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Role:</span>
              <Badge variant="outline">{profile?.role}</Badge>
            </div>

            {/* Last Login */}
            {profile?.last_login && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Login:</span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(profile.last_login).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <Button
                onClick={sendUserInvite}
                disabled={sending}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Password Reset Link'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* No Portal Access */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                No portal account found for this client
              </span>
            </div>

            {/* Email Check */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm text-muted-foreground">{client.email}</span>
            </div>

            {/* Create Account Action */}
            <div className="pt-2">
              <Button
                onClick={sendUserInvite}
                disabled={sending || !client.email}
                size="sm"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Portal Invite'}
              </Button>
              {!client.email && (
                <p className="text-xs text-muted-foreground mt-2">
                  Client email required to send invite
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
