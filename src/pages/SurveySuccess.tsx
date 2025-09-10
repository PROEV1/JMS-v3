import React, { useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { DualBrandHeader } from '@/components/survey/DualBrandHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface SurveySuccessProps {
  orderNumber?: string;
  partnerBrand?: {
    name: string;
    logo_url: string;
    hex: string;
  };
}

export default function SurveySuccess() {
  const location = useLocation();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { finalRole: role } = useAuth();
  const { user } = useAuth();
  const { orderNumber, partnerBrand } = location.state || {};

  const getReturnUrl = () => {
    if (role === 'partner_user') {
      return '/partner';
    }
    if (orderId) {
      return `/client/orders/${orderId}`;
    }
    return '/client/orders';
  };

  const handleReturnToPortal = () => {
    const targetUrl = getReturnUrl();
    
    if (!user) {
      // User is not authenticated, set redirect path and go to auth
      sessionStorage.setItem('authRedirectPath', targetUrl);
      navigate('/auth');
    } else {
      // User is authenticated, go directly to target
      navigate(targetUrl);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleReturnToPortal();
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, role, orderId, user]);

  return (
    <div className="min-h-screen bg-background">
      <DualBrandHeader partnerBrand={partnerBrand} />
      
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border-[hsl(var(--status-accepted-bg))] bg-[hsl(var(--status-accepted-bg))]">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-[hsl(var(--status-accepted))] mx-auto mb-4" />
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Survey Submitted Successfully!
              </h1>
              <p className="text-muted-foreground">
                Thank you for completing your installation survey
                {orderNumber && ` for order #${orderNumber}`}.
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 mb-6 border border-border shadow-sm">
              <h2 className="font-semibold text-foreground mb-4">What happens next?</h2>
              
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Review Process</p>
                    <p className="text-sm text-muted-foreground">
                      Our team will review your survey responses and photos within 1-2 business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Installation Scheduling</p>
                    <p className="text-sm text-muted-foreground">
                      Once approved, we'll contact you to schedule your EV charger installation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Professional Installation</p>
                    <p className="text-sm text-muted-foreground">
                      Our certified engineers will complete your installation on the scheduled date.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[hsl(var(--status-pending-bg))] border border-[hsl(var(--status-pending-bg))] rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2 text-[hsl(var(--status-pending))]">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  We may contact you if we need any additional information
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleReturnToPortal}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Return to your portal
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <p className="text-center text-sm text-muted-foreground">
                Redirecting you to your portal in a few seconds...
              </p>
              
              <p className="text-center text-sm text-muted-foreground">
                If you have any questions or need to make changes, please contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}