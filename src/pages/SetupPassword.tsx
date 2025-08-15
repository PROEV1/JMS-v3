import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProSpacesLogo } from '@/components/ProSpacesLogo';
import { Eye, EyeOff } from 'lucide-react';

export default function SetupPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Handle Supabase's password recovery flow
    const handleAuthRecovery = async () => {
      // Get tokens from URL hash or query params
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      
      // Check for tokens in hash fragment (Supabase's default)
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && refreshToken && type === 'recovery') {
          // Set the session using tokens from hash
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('Session setup error:', error);
              toast({
                title: "Invalid Link",
                description: "This password setup link is invalid or has expired. Please contact support.",
                variant: "destructive",
              });
              navigate('/auth');
            }
          } catch (error) {
            console.error('Auth recovery error:', error);
            toast({
              title: "Invalid Link", 
              description: "This password setup link is invalid or has expired. Please contact support.",
              variant: "destructive",
            });
            navigate('/auth');
          }
          return;
        }
      }
      
      // Fallback: check query params for legacy support
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      
      if (accessToken && refreshToken && type === 'recovery') {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            throw error;
          }
        } catch (error) {
          console.error('Auth recovery error:', error);
          toast({
            title: "Invalid Link",
            description: "This password setup link is invalid or has expired. Please contact support.", 
            variant: "destructive",
          });
          navigate('/auth');
        }
      } else {
        // No valid tokens found
        toast({
          title: "Invalid Link",
          description: "This password setup link is invalid or has expired. Please contact support.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };
    
    handleAuthRecovery();
  }, [navigate, toast]);

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user is authenticated from the session setup in useEffect
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No valid session found. Please try clicking the link in your email again.');
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Password Set Successfully!",
        description: "Your password has been created. You're now being redirected to your dashboard.",
      });

      // Small delay before redirect
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error('Password setup error:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to set up password. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <ProSpacesLogo variant="main" size="lg" />
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Set Up Your Password</CardTitle>
            <CardDescription>
              Welcome to ProSpaces Portal! Please create a secure password to complete your account setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetupPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Password must be at least 6 characters long.
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Setting up password..." : "Set Up Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}