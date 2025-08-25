import React, { useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { DualBrandHeader } from '@/components/survey/DualBrandHeader';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { role } = useUserRole();
  const { orderNumber, partnerBrand } = location.state || {};

  const getReturnUrl = () => {
    if (role === 'partner') {
      return '/partner';
    }
    if (orderId) {
      return `/client/orders/${orderId}`;
    }
    return '/client/orders';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(getReturnUrl());
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, role, orderId]);

  return (
    <div className="min-h-screen bg-background">
      <DualBrandHeader partnerBrand={partnerBrand} />
      
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border-[hsl(var(--status-accepted-bg))] bg-[hsl(var(--status-accepted-bg))]">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-[hsl(var(--status-accepted))] mx-auto mb-4" />
              <h1 className="text-2xl font-semibold font-montserrat text-foreground mb-2">
                Survey Submitted Successfully!
              </h1>
              <p className="text-muted-foreground font-montserrat">
                Thank you for completing your installation survey
                {orderNumber && ` for order #${orderNumber}`}.
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 mb-6 border border-border shadow-sm">
              <h2 className="font-semibold font-montserrat text-foreground mb-4">What happens next?</h2>
              
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium font-montserrat text-foreground">Review Process</p>
                    <p className="text-sm text-muted-foreground font-montserrat">
                      Our team will review your survey responses and photos within 1-2 business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium font-montserrat text-foreground">Installation Scheduling</p>
                    <p className="text-sm text-muted-foreground font-montserrat">
                      Once approved, we'll contact you to schedule your EV charger installation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium font-montserrat text-foreground">Professional Installation</p>
                    <p className="text-sm text-muted-foreground font-montserrat">
                      Our certified engineers will complete your installation on the scheduled date.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[hsl(var(--status-pending-bg))] border border-[hsl(var(--status-pending-bg))] rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2 text-[hsl(var(--status-pending))]">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium font-montserrat">
                  We may contact you if we need any additional information
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => navigate(getReturnUrl())}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Return to your portal
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <p className="text-center text-sm text-muted-foreground font-montserrat">
                Redirecting you to your portal in a few seconds...
              </p>
              
              <p className="text-center text-sm text-muted-foreground font-montserrat">
                If you have any questions or need to make changes, please contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}