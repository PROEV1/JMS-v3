import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ProSpacesLogo } from '@/components/ProSpacesLogo';
import { ExternalLink } from 'lucide-react';

interface AgreementSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onAgreementSigned: () => void;
}

export function AgreementSigningModal({ 
  isOpen, 
  onClose, 
  order, 
  onAgreementSigned 
}: AgreementSigningModalProps) {
  const [loading, setLoading] = useState(false);
  const [agreementContent, setAgreementContent] = useState<string>('');
  const [contentLoaded, setContentLoaded] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsUrl, setTermsUrl] = useState<string>('');
  const [agreementDocumentUrl, setAgreementDocumentUrl] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<{name?: string; terms?: string}>({});
  const { toast } = useToast();

  // Load system settings for T&Cs URL
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        console.log('AgreementSigningModal: Fetching system settings...');
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'system_settings')
          .maybeSingle();

        console.log('AgreementSigningModal: Settings fetch result:', { data, error });

        if (error) {
          console.error('AgreementSigningModal: Error fetching settings:', error);
          // Set fallback URL if there's an error
          setAgreementDocumentUrl('https://www.prospaces.co.uk');
          return;
        }

        if (data && data.setting_value) {
          const systemSettings = data.setting_value as any;
          console.log('AgreementSigningModal: System settings:', systemSettings);
          
          if (systemSettings?.terms_conditions_url) {
            console.log('AgreementSigningModal: Setting terms URL:', systemSettings.terms_conditions_url);
            setTermsUrl(systemSettings.terms_conditions_url);
          }
          if (systemSettings?.agreement_document_url) {
            console.log('AgreementSigningModal: Setting agreement doc URL:', systemSettings.agreement_document_url);
            setAgreementDocumentUrl(systemSettings.agreement_document_url);
          } else {
            // Fallback if no URL configured
            console.log('AgreementSigningModal: No agreement_document_url found, using fallback');
            setAgreementDocumentUrl('https://www.prospaces.co.uk');
          }
        } else {
          console.log('AgreementSigningModal: No system settings found, using fallback URL');
          // Set fallback URL if no settings found
          setAgreementDocumentUrl('https://www.prospaces.co.uk');
        }
      } catch (error) {
        console.error('AgreementSigningModal: Error in fetchSystemSettings:', error);
        // Set fallback URL on error
        setAgreementDocumentUrl('https://www.prospaces.co.uk');
      }
    };

    if (isOpen) {
      fetchSystemSettings();
    }
  }, [isOpen]);

  const loadAgreementContent = async () => {
    if (contentLoaded) return;
    
    try {
      setLoading(true);
      
      // Provide default agreement content since generate-quote-pdf doesn't handle 'agreement' type
      const defaultAgreementContent = `
        <div class="agreement-content">
          <h1>ProSpaces Installation Service Agreement</h1>
          <h2>Order: ${order?.order_number || 'N/A'}</h2>
          <br>
          
          <h3>Agreement Summary</h3>
          <p>By signing below, you agree to the terms of the ProSpaces Installation Service Agreement. This includes:</p>
          
          <ul>
            <li><strong>Scope of works</strong> as per accepted quote</li>
            <li><strong>Payment terms</strong> and cancellation policy</li>
            <li><strong>Site access</strong> and installation expectations</li>
            <li><strong>Warranty terms</strong> (${order?.quote?.warranty_period || '5 years'})</li>
          </ul>
          
          <h3>Products to be Installed</h3>
          <ul>
            ${order?.quote?.quote_items?.map(item => 
              `<li>${item.product_name} (Qty: ${item.quantity}) - £${item.total_price}</li>`
            ).join('') || '<li>Product details not available</li>'}
          </ul>
          
          <h3>Total Order Value</h3>
          <p><strong>£${order?.total_amount || 0}</strong></p>
          
          <br>
          <p><em>Please review the full agreement using the "View Full Agreement" button before signing.</em></p>
          
          <h3>Terms and Conditions</h3>
          <p>By signing this agreement, you acknowledge that you have read, understood, and agree to be bound by the terms and conditions of the ProSpaces Installation Service Agreement.</p>
        </div>
      `;
      
      setAgreementContent(defaultAgreementContent);
      setContentLoaded(true);
      
    } catch (error) {
      console.error('Error loading agreement:', error);
      toast({
        title: "Error",
        description: "Failed to load agreement content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    // Clear previous errors
    setValidationErrors({});
    
    // Validate form
    const errors: {name?: string; terms?: string} = {};
    
    if (!signerName.trim()) {
      errors.name = "Please enter your full name";
    }
    
    if (!agreedToTerms) {
      errors.terms = "Please accept the terms and conditions";
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Please complete required fields",
        description: "Please enter your name and accept the terms before signing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Update the order with signature information
      const { error } = await supabase
        .from('orders')
        .update({
          agreement_signed_at: new Date().toISOString(),
          status: 'agreement_signed'
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Agreement Signed",
        description: "Your agreement has been successfully signed and recorded",
      });

      onAgreementSigned();
      onClose();
    } catch (error) {
      console.error('Error signing agreement:', error);
      toast({
        title: "Error",
        description: "Failed to sign agreement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openFullAgreement = () => {
    if (agreementDocumentUrl) {
      // Use the configured Agreement Document URL from admin settings
      window.open(agreementDocumentUrl, '_blank');
    } else {
      toast({
        title: "Agreement not available",
        description: "Please contact support for the full agreement document.",
        variant: "destructive",
      });
    }
  };

  // Load content when modal opens
  if (isOpen && !contentLoaded && !loading) {
    console.log('AgreementSigningModal: Modal opened, loading content');
    loadAgreementContent();
  }

  console.log('AgreementSigningModal render:', { 
    isOpen, 
    loading, 
    contentLoaded, 
    signerName: signerName.trim(),
    agreedToTerms,
    termsUrl,
    agreementDocumentUrl,
    buttonDisabled: loading || !signerName.trim() || !agreedToTerms
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0">
        <div className="p-6 border-b flex-shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <ProSpacesLogo variant="main" size="md" />
                <div>
                  <DialogTitle className="text-xl">Agreement Review & Signature</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please review the agreement carefully before signing
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Agreement Summary */}
          <div className="bg-muted/30 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Agreement Summary</h3>
            
            <p className="text-sm text-muted-foreground mb-4">
              By signing below, you agree to the terms of the ProSpaces Installation Service Agreement. This includes:
            </p>
            
            <ul className="space-y-2 text-sm text-muted-foreground mb-4">
              <li className="flex items-start space-x-2">
                <span className="text-foreground">•</span>
                <span>Scope of works as per accepted quote</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-foreground">•</span>
                <span>Payment terms and cancellation policy</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-foreground">•</span>
                <span>Site access and installation expectations</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-foreground">•</span>
                <span>Warranty terms (5 years)</span>
              </li>
            </ul>
            
            <p className="text-sm text-muted-foreground">
              Please review the full agreement before signing.
            </p>
          </div>

          {/* View Full Agreement Button */}
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={openFullAgreement}
              disabled={loading}
              className="mb-6"
            >
              View Full Agreement
            </Button>
          </div>

          {/* Digital Signature Section */}
          <div className="bg-muted/30 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-6">Digital Signature</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="signerName" className="text-base font-medium">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="signerName"
                  placeholder="Enter your full name"
                  value={signerName}
                  onChange={(e) => {
                    setSignerName(e.target.value);
                    if (validationErrors.name) {
                      setValidationErrors(prev => ({ ...prev, name: undefined }));
                    }
                  }}
                  className={`h-12 ${validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                {validationErrors.name && (
                  <p className="text-sm text-destructive">{validationErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-base font-medium">Date</Label>
                <Input
                  value={new Date().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                  disabled
                  className="h-12 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreement"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => {
                    setAgreedToTerms(checked as boolean);
                    if (validationErrors.terms) {
                      setValidationErrors(prev => ({ ...prev, terms: undefined }));
                    }
                  }}
                  className={`mt-1 ${validationErrors.terms ? 'border-destructive data-[state=checked]:bg-destructive' : ''}`}
                />
                <div className="space-y-1">
                  <Label htmlFor="agreement" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the terms and conditions outlined in this agreement
                    {termsUrl && (
                      <>
                        {" and the "}
                        <a 
                          href={termsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-foreground underline hover:no-underline inline-flex items-center"
                        >
                          Terms & Conditions
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </>
                    )}
                  </Label>
                  {validationErrors.terms && (
                    <p className="text-sm text-destructive">{validationErrors.terms}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <Button 
                onClick={handleSign}
                disabled={loading || !signerName.trim() || !agreedToTerms}
                className="px-12 py-3 text-lg font-semibold"
                size="lg"
              >
                {loading ? "Signing..." : "Click to Sign"}
              </Button>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="px-8">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}