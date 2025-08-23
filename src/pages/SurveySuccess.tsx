import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { DualBrandHeader } from '@/components/survey/DualBrandHeader';

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
  const { orderNumber, partnerBrand } = location.state || {};
  return (
    <div className="min-h-screen bg-background">
      <DualBrandHeader partnerBrand={partnerBrand} />
      
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Survey Submitted Successfully!
              </h1>
              <p className="text-slate-600">
                Thank you for completing your installation survey
                {orderNumber && ` for order #${orderNumber}`}.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 mb-6 border border-green-200">
              <h2 className="font-semibold text-slate-900 mb-4">What happens next?</h2>
              
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Review Process</p>
                    <p className="text-sm text-slate-600">
                      Our team will review your survey responses and photos within 1-2 business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Installation Scheduling</p>
                    <p className="text-sm text-slate-600">
                      Once approved, we'll contact you to schedule your EV charger installation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-medium text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Professional Installation</p>
                    <p className="text-sm text-slate-600">
                      Our certified engineers will complete your installation on the scheduled date.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2 text-amber-800">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  We may contact you if we need any additional information
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              If you have any questions or need to make changes, please contact our support team.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}