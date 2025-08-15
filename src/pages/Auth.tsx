import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { ProEVLogo } from '@/components/ProEVLogo';
import { BrandPage, BrandContainer, BrandLoading } from '@/components/brand/BrandLayout';
import { BrandButton } from '@/components/brand/BrandButton';
import { BrandHeading1, BrandHeading2, BrandBody } from '@/components/brand/BrandTypography';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !authLoading) {
      console.log('Auth: User authenticated, preparing redirect', { userId: user.id, email: user.email });
      // Redirect authenticated users to dashboard for role-based routing
      setTimeout(() => {
        console.log('Auth: Executing redirect to dashboard');
        navigate('/dashboard', { replace: true });
      }, 500);
    }
  }, [user, authLoading, navigate]);

  // Show loading while auth is checking or redirecting
  if (authLoading || user) {
    return <BrandLoading />;
  }



  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Sign Up button clicked!');
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        toast({
          title: "Error signing up",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Please check your email for verification.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Sign In button clicked!');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Error signing in",
          description: error.message,
          variant: "destructive",
        });
      } else if (data.user) {
        // Force navigation after successful login
        toast({
          title: "Success!",
          description: "Signed in successfully",
        });
        
        // Force navigation after successful login
        console.log('Auth: Login successful, user data:', data.user);
        setTimeout(() => {
          console.log('Auth: Forcing navigation to dashboard');
          navigate('/dashboard', { replace: true });
        }, 300);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandPage className="bg-white">
      <BrandContainer className="flex flex-col items-center justify-center min-h-screen py-12">
        {/* Logo Section */}
        <div className="mb-12">
          <ProEVLogo variant="main" size="xl" />
        </div>
        
        {/* Main Heading */}
        <div className="text-center mb-8">
          <BrandHeading1 className="mb-3">Welcome to Pro EV</BrandHeading1>
          <BrandBody className="text-muted-foreground max-w-md">
            Access your personalized client portal to view quotes, track projects, and manage your home improvements.
          </BrandBody>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <div className="p-8">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-11">
                  <TabsTrigger 
                    value="signin" 
                    className="text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup"
                    className="text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin" className="space-y-6">
                  <div className="text-center mb-6">
                    <BrandHeading2 className="mb-2">Sign In</BrandHeading2>
                    <BrandBody className="text-muted-foreground">
                      Access your account to continue
                    </BrandBody>
                  </div>
                  
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 bg-gray-50 border-gray-200 focus:border-brand-teal focus:ring-brand-teal"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 bg-gray-50 border-gray-200 focus:border-brand-teal focus:ring-brand-teal"
                        placeholder="Enter your password"
                      />
                    </div>
                    <BrandButton 
                      type="submit" 
                      className="w-full h-11 mt-6" 
                      brandVariant="primary"
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign In to Portal"}
                    </BrandButton>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-6">
                  <div className="text-center mb-6">
                    <BrandHeading2 className="mb-2">Create Account</BrandHeading2>
                    <BrandBody className="text-muted-foreground">
                      Join Pro EV to get started
                    </BrandBody>
                  </div>
                  
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="h-11 bg-gray-50 border-gray-200 focus:border-brand-teal focus:ring-brand-teal"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 bg-gray-50 border-gray-200 focus:border-brand-teal focus:ring-brand-teal"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 bg-gray-50 border-gray-200 focus:border-brand-teal focus:ring-brand-teal"
                        placeholder="Create a password"
                      />
                    </div>
                    <BrandButton 
                      type="submit" 
                      className="w-full h-11 mt-6" 
                      brandVariant="secondary"
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Create Account"}
                    </BrandButton>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center">
          <BrandBody className="text-muted-foreground text-sm">
            © 2024 Pro EV. All rights reserved.
          </BrandBody>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}