import React from 'react';
import { ProEVLogo } from '@/components/ProEVLogo';
import { Mail, Phone } from 'lucide-react';

export function SurveyFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card/50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          {/* Support Information */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">Need help with your survey?</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a 
                  href="mailto:support@proev.co.uk" 
                  className="hover:text-foreground transition-colors"
                >
                  support@proev.co.uk
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a 
                  href="tel:+441234567890" 
                  className="hover:text-foreground transition-colors"
                >
                  01234 567890
                </a>
              </div>
            </div>
          </div>

          {/* Brand */}
          <div className="flex flex-col items-center gap-3">
            <ProEVLogo className="h-6 opacity-60" />
            <p className="text-xs text-muted-foreground">
              © 2024 Pro EV. Professional EV charger installation services.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}