import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, Mail, Key, UserCheck, AlertTriangle, UserPlus } from 'lucide-react';

interface EngineerUserSetupProps {
  engineer: {
    id: string;
    name: string;
    email: string;
    user_id?: string | null;
  };
  onUpdate: () => void;
}

export function EngineerUserSetup({ engineer, onUpdate }: EngineerUserSetupProps) {
  const [userAccount, setUserAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (engineer.user_id) {
      fetchUserAccount();
    }
  }, [engineer.user_id]);

  const fetchUserAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', engineer.user_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUserAccount(data);
    } catch (error) {
      console.error('Error fetching user account:', error);
    }
  };

  const createUserAccount = async () => {
    setCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-user-invite', {
        body: {
          email: engineer.email,
          full_name: engineer.name,
          role: 'engineer'
        }
      });

      if (error) throw error;

      toast({
        title: "User Account Created",
        description: `Login credentials have been sent to ${engineer.email}. The engineer can now log in to the system.`,
      });

      // Link the new user to the engineer
      if (data.user_id) {
        await linkUserToEngineer(data.user_id);
      }

      onUpdate();
    } catch (error: any) {
      console.error('Error creating user account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user account",
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const createUserWithPassword = async () => {
    if (!password || password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match or are empty",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-engineer-user', {
        body: {
          email: engineer.email,
          full_name: engineer.name,
          password: password,
          engineer_id: engineer.id
        }
      });

      if (error) throw error;

      toast({
        title: "User Account Created",
        description: `Account created successfully for ${engineer.name}. They can now log in with the password you set.`,
      });

      setPassword('');
      setConfirmPassword('');
      setShowPasswordSetup(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error creating user account with password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user account",
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const linkUserToEngineer = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('engineers')
        .update({ user_id: userId })
        .eq('id', engineer.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error linking user to engineer:', error);
    }
  };

  const resetPassword = async () => {
    if (!engineer.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(engineer.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Sent",
        description: `Password reset instructions have been sent to ${engineer.email}`,
      });
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>User Account Setup</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{engineer.name}</p>
            <p className="text-sm text-muted-foreground">{engineer.email}</p>
          </div>
          
          {userAccount ? (
            <Badge className="bg-green-100 text-green-800">
              <UserCheck className="h-3 w-3 mr-1" />
              Account Active
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertTriangle className="h-3 w-3 mr-1" />
              No Account
            </Badge>
          )}
        </div>

        {userAccount ? (
          <div className="space-y-3">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Engineer has an active user account and can log in to the system
              </p>
              <p className="text-xs text-green-600 mt-1">
                Role: {userAccount.role} • Status: {userAccount.status}
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPassword}
                disabled={loading}
              >
                <Key className="h-3 w-3 mr-1" />
                {loading ? "Sending..." : "Reset Password"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ This engineer doesn't have a user account yet. They cannot log in to the system.
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Create an account to enable login and mobile app access.
              </p>
            </div>

            <div className="flex flex-col space-y-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={creatingAccount}>
                    <Mail className="h-3 w-3 mr-1" />
                    {creatingAccount ? "Creating..." : "Send Invite Email"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send Email Invite</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will create a login account for {engineer.name} and send them login credentials via email to {engineer.email}.
                      
                      The engineer will be able to:
                      • Log in to the web dashboard
                      • View and update their job assignments
                      • Manage their availability and schedule
                      • Upload job completion photos and documents
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={createUserAccount}>
                      Create Account & Send Credentials
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button 
                variant="outline" 
                size="sm" 
                disabled={creatingAccount}
                onClick={() => setShowPasswordSetup(true)}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Create with Password
              </Button>
            </div>

            <AlertDialog open={showPasswordSetup} onOpenChange={setShowPasswordSetup}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create Account with Password</AlertDialogTitle>
                  <AlertDialogDescription>
                    Create a login account for {engineer.name} and set their password directly (no email required).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (min 6 characters)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={createUserWithPassword}
                    disabled={!password || password !== confirmPassword || password.length < 6}
                  >
                    {creatingAccount ? "Creating..." : "Create Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}