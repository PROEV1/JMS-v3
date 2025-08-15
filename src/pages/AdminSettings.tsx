import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BrandPage, BrandContainer, BrandHeading1 } from '@/components/brand';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Save, Settings, CreditCard, Mail, MessageSquare, Bell, AlertTriangle, Calendar } from 'lucide-react';
import { SchedulingSettingsPanel } from '@/components/admin/SchedulingSettingsPanel';

interface AdminSettings {
  quote_defaults: QuoteDefaults;
  payment_config: PaymentConfig;
  stripe_config: StripeConfig;
  email_config: EmailConfig;
  sms_config: SmsConfig;
  notification_settings: NotificationSettings;
  system_settings: SystemSettings;
}

interface QuoteDefaults {
  default_deposit_percentage: number;
  default_warranty_period: string;
}

interface PaymentConfig {
  payment_stage: 'deposit' | 'full' | 'staged';
  deposit_type: 'percentage' | 'fixed';
  deposit_amount: number;
  currency: string;
}

interface StripeConfig {
  environment: 'test' | 'live';
  test_publishable_key: string;
  test_secret_key: string;
  live_publishable_key: string;
  live_secret_key: string;
  test_webhook_endpoint: string;
  live_webhook_endpoint: string;
  test_product_prices: {
    deposit: string;
    full_payment: string;
  };
  live_product_prices: {
    deposit: string;
    full_payment: string;
  };
}

interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'smtp';
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  templates: {
    quote_sent: string;
    payment_received: string;
    order_confirmed: string;
  };
}

interface SmsConfig {
  provider: 'twilio' | 'aws_sns';
  account_sid: string;
  auth_token: string;
  from_number: string;
  templates: {
    order_update: string;
    payment_reminder: string;
  };
}

interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  auto_invoice_generation: boolean;
  payment_reminders: boolean;
  order_status_updates: boolean;
  reminder_timing: {
    first_reminder: number;
    second_reminder: number;
    final_reminder: number;
  };
}

interface SystemSettings {
  maintenance_mode: boolean;
  feature_flags: {
    online_payments: boolean;
    sms_notifications: boolean;
    file_uploads: boolean;
    quote_sharing: boolean;
  };
  app_name: string;
  support_email: string;
  terms_conditions_url: string;
  agreement_document_url: string;
  default_currency: string;
  timezone: string;
}

const defaultSettings: AdminSettings = {
  quote_defaults: {
    default_deposit_percentage: 30,
    default_warranty_period: '5 years'
  },
  payment_config: {
    payment_stage: 'deposit',
    deposit_type: 'percentage',
    deposit_amount: 30,
    currency: 'GBP'
  },
  stripe_config: {
    environment: 'test',
    test_publishable_key: '',
    test_secret_key: '',
    live_publishable_key: '',
    live_secret_key: '',
    test_webhook_endpoint: '',
    live_webhook_endpoint: '',
    test_product_prices: {
      deposit: 'price_test_deposit',
      full_payment: 'price_test_full'
    },
    live_product_prices: {
      deposit: '',
      full_payment: ''
    }
  },
  email_config: {
    provider: 'resend',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: 'ProSpaces',
    templates: {
      quote_sent: 'default',
      payment_received: 'default',
      order_confirmed: 'default'
    }
  },
  sms_config: {
    provider: 'twilio',
    account_sid: '',
    auth_token: '',
    from_number: '',
    templates: {
      order_update: 'Your order {{order_number}} has been updated: {{status}}',
      payment_reminder: 'Payment reminder for order {{order_number}}. Amount due: {{amount}}'
    }
  },
  notification_settings: {
    email_notifications: true,
    sms_notifications: false,
    auto_invoice_generation: true,
    payment_reminders: true,
    order_status_updates: true,
    reminder_timing: {
      first_reminder: 7,
      second_reminder: 14,
      final_reminder: 21
    }
  },
  system_settings: {
    maintenance_mode: false,
    feature_flags: {
      online_payments: true,
      sms_notifications: false,
      file_uploads: true,
      quote_sharing: true
    },
    app_name: 'ProSpaces',
    support_email: 'support@prospace.com',
    terms_conditions_url: 'https://prospace.com/terms',
    agreement_document_url: '',
    default_currency: 'USD',
    timezone: 'UTC'
  }
};

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const newSettings = { ...defaultSettings };
      
      data?.forEach((item) => {
        if (item.setting_key in newSettings) {
          (newSettings as any)[item.setting_key] = item.setting_value;
        }
      });

      setSettings(newSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsToSave = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value
      }));

      const { error } = await supabase
        .from('admin_settings')
        .upsert(settingsToSave, { onConflict: 'setting_key' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = <T extends keyof AdminSettings>(
    category: T,
    updates: Partial<AdminSettings[T]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], ...updates }
    }));
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  if (loading) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg">Loading settings...</div>
            </div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Settings className="h-8 w-8" />
              <div>
                <BrandHeading1>Admin Settings</BrandHeading1>
                <p className="text-muted-foreground">Configure system-wide settings and integrations</p>
              </div>
            </div>
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save All Settings'}
            </Button>
          </div>

          {/* Environment Indicator */}
          {settings.stripe_config.environment === 'test' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-yellow-800 font-medium">Test Mode Active</p>
                <p className="text-yellow-700 text-sm">Stripe is in test mode. No real payments will be processed.</p>
              </div>
            </div>
          )}

          <Tabs defaultValue="quotes" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="quotes" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Quotes</span>
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Scheduling</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4" />
                <span>Payments</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>SMS</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center space-x-2">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>System</span>
              </TabsTrigger>
            </TabsList>

            {/* Quote Defaults Configuration */}
            <TabsContent value="quotes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quote Defaults</CardTitle>
                  <CardDescription>Set default values for new quotes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>Default Deposit Percentage</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.quote_defaults.default_deposit_percentage}
                        onChange={(e) => updateSettings('quote_defaults', { 
                          default_deposit_percentage: parseInt(e.target.value) || 0 
                        })}
                        placeholder="30"
                      />
                      <p className="text-sm text-muted-foreground">
                        Default deposit percentage for new quotes (can be overridden when creating quotes)
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Default Warranty Period</Label>
                      <Select 
                        value={settings.quote_defaults.default_warranty_period} 
                        onValueChange={(value) => 
                          updateSettings('quote_defaults', { default_warranty_period: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1 year">1 Year</SelectItem>
                          <SelectItem value="2 years">2 Years</SelectItem>
                          <SelectItem value="3 years">3 Years</SelectItem>
                          <SelectItem value="5 years">5 Years</SelectItem>
                          <SelectItem value="10 years">10 Years</SelectItem>
                          <SelectItem value="Lifetime">Lifetime</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Default warranty period for new quotes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scheduling Configuration */}
            <TabsContent value="scheduling" className="space-y-6">
              <SchedulingSettingsPanel />
            </TabsContent>

            {/* Payment & Stripe Configuration */}
            <TabsContent value="payments" className="space-y-6">
              <div className="grid gap-6">
                {/* Stripe Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5" />
                      <span>Stripe Configuration</span>
                      <Badge variant={settings.stripe_config.environment === 'test' ? 'secondary' : 'default'}>
                        {settings.stripe_config.environment === 'test' ? 'Test Mode' : 'Live Mode'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Configure Stripe payment processing. Use test mode for development and testing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Environment Toggle */}
                    <div className="space-y-3">
                      <Label>Environment</Label>
                      <Select 
                        value={settings.stripe_config.environment} 
                        onValueChange={(value: 'test' | 'live') => 
                          updateSettings('stripe_config', { environment: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="test">Test Mode (Safe for development)</SelectItem>
                          <SelectItem value="live">Live Mode (Real payments)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Test Keys */}
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Test Environment Keys</Label>
                      
                      <div className="space-y-3">
                        <Label>Test Publishable Key</Label>
                        <Input
                          type="password"
                          placeholder="pk_test_..."
                          value={settings.stripe_config.test_publishable_key}
                          onChange={(e) => updateSettings('stripe_config', { 
                            test_publishable_key: e.target.value 
                          })}
                        />
                        <p className="text-sm text-muted-foreground">
                          {settings.stripe_config.test_publishable_key && 
                            `Set: ${maskApiKey(settings.stripe_config.test_publishable_key)}`
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Label>Test Secret Key</Label>
                        <Input
                          type="password"
                          placeholder="sk_test_..."
                          value={settings.stripe_config.test_secret_key}
                          onChange={(e) => updateSettings('stripe_config', { 
                            test_secret_key: e.target.value 
                          })}
                        />
                        <p className="text-sm text-muted-foreground">
                          {settings.stripe_config.test_secret_key && 
                            `Set: ${maskApiKey(settings.stripe_config.test_secret_key)}`
                          }
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Test Product Prices */}
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Test Price IDs</Label>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label>Deposit Price ID</Label>
                          <Input
                            placeholder="price_test_..."
                            value={settings.stripe_config.test_product_prices.deposit}
                            onChange={(e) => updateSettings('stripe_config', { 
                              test_product_prices: {
                                ...settings.stripe_config.test_product_prices,
                                deposit: e.target.value
                              }
                            })}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <Label>Full Payment Price ID</Label>
                          <Input
                            placeholder="price_test_..."
                            value={settings.stripe_config.test_product_prices.full_payment}
                            onChange={(e) => updateSettings('stripe_config', { 
                              test_product_prices: {
                                ...settings.stripe_config.test_product_prices,
                                full_payment: e.target.value
                              }
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Test Cards Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Test Card Numbers</h4>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p><strong>Success:</strong> 4242 4242 4242 4242</p>
                        <p><strong>Declined:</strong> 4000 0000 0000 0002</p>
                        <p><strong>Insufficient funds:</strong> 4000 0000 0000 9995</p>
                        <p><strong>3D Secure:</strong> 4000 0000 0000 3220</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Flow Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Flow Configuration</CardTitle>
                    <CardDescription>Configure how payments are collected from clients</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Payment Stage */}
                    <div className="space-y-3">
                      <Label>Payment Stage Required</Label>
                      <Select 
                        value={settings.payment_config.payment_stage} 
                        onValueChange={(value: 'deposit' | 'full' | 'staged') => 
                          updateSettings('payment_config', { payment_stage: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit Only</SelectItem>
                          <SelectItem value="full">Full Payment</SelectItem>
                          <SelectItem value="staged">Staged (Deposit then Balance)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Deposit Configuration */}
                    {(settings.payment_config.payment_stage === 'deposit' || 
                      settings.payment_config.payment_stage === 'staged') && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <Label>Deposit Type</Label>
                            <Select 
                              value={settings.payment_config.deposit_type} 
                              onValueChange={(value: 'percentage' | 'fixed') => 
                                updateSettings('payment_config', { deposit_type: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Percentage of Total</SelectItem>
                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-3">
                            <Label>
                              Deposit Amount 
                              {settings.payment_config.deposit_type === 'percentage' ? ' (%)' : ` (${settings.payment_config.currency})`}
                            </Label>
                            <Input
                              type="number"
                              value={settings.payment_config.deposit_amount}
                              onChange={(e) => updateSettings('payment_config', { 
                                deposit_amount: parseFloat(e.target.value) || 0 
                              })}
                              min="0"
                              max={settings.payment_config.deposit_type === 'percentage' ? "100" : undefined}
                              step={settings.payment_config.deposit_type === 'percentage' ? "1" : "0.01"}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Currency */}
                    <div className="space-y-3">
                      <Label>Currency</Label>
                      <Select 
                        value={settings.payment_config.currency} 
                        onValueChange={(value) => updateSettings('payment_config', { currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Email Configuration */}
            <TabsContent value="email" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Mail className="h-5 w-5" />
                    <span>Email Configuration</span>
                  </CardTitle>
                  <CardDescription>Configure email service for automated notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Email Provider</Label>
                    <Select 
                      value={settings.email_config.provider} 
                      onValueChange={(value: 'resend' | 'sendgrid' | 'smtp') => 
                        updateSettings('email_config', { provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resend">Resend (Recommended)</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="smtp">Custom SMTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label>From Email</Label>
                      <Input
                        type="email"
                        placeholder="no-reply@yourdomain.com"
                        value={settings.email_config.from_email}
                        onChange={(e) => updateSettings('email_config', { from_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>From Name</Label>
                      <Input
                        placeholder="ProSpaces"
                        value={settings.email_config.from_name}
                        onChange={(e) => updateSettings('email_config', { from_name: e.target.value })}
                      />
                    </div>
                  </div>

                  {settings.email_config.provider === 'smtp' && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <Label className="text-base font-medium">SMTP Configuration</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Label>SMTP Host</Label>
                            <Input
                              placeholder="smtp.gmail.com"
                              value={settings.email_config.smtp_host}
                              onChange={(e) => updateSettings('email_config', { smtp_host: e.target.value })}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label>SMTP Port</Label>
                            <Input
                              type="number"
                              placeholder="587"
                              value={settings.email_config.smtp_port}
                              onChange={(e) => updateSettings('email_config', { 
                                smtp_port: parseInt(e.target.value) || 587 
                              })}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label>Username</Label>
                            <Input
                              value={settings.email_config.smtp_username}
                              onChange={(e) => updateSettings('email_config', { smtp_username: e.target.value })}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label>Password</Label>
                            <Input
                              type="password"
                              value={settings.email_config.smtp_password}
                              onChange={(e) => updateSettings('email_config', { smtp_password: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SMS Configuration */}
            <TabsContent value="sms" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>SMS Configuration</span>
                  </CardTitle>
                  <CardDescription>Configure SMS service for notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>SMS Provider</Label>
                    <Select 
                      value={settings.sms_config.provider} 
                      onValueChange={(value: 'twilio' | 'aws_sns') => 
                        updateSettings('sms_config', { provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="aws_sns">AWS SNS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label>Account SID</Label>
                      <Input
                        type="password"
                        value={settings.sms_config.account_sid}
                        onChange={(e) => updateSettings('sms_config', { account_sid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Auth Token</Label>
                      <Input
                        type="password"
                        value={settings.sms_config.auth_token}
                        onChange={(e) => updateSettings('sms_config', { auth_token: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>From Number</Label>
                    <Input
                      placeholder="+1234567890"
                      value={settings.sms_config.from_number}
                      onChange={(e) => updateSettings('sms_config', { from_number: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="h-5 w-5" />
                    <span>Notification Settings</span>
                  </CardTitle>
                  <CardDescription>Configure when and how notifications are sent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send automated emails for order updates</p>
                      </div>
                      <Switch 
                        checked={settings.notification_settings.email_notifications}
                        onCheckedChange={(checked) => 
                          updateSettings('notification_settings', { email_notifications: checked })
                        }
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send SMS updates for important events</p>
                      </div>
                      <Switch 
                        checked={settings.notification_settings.sms_notifications}
                        onCheckedChange={(checked) => 
                          updateSettings('notification_settings', { sms_notifications: checked })
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Payment Reminders</Label>
                        <p className="text-sm text-muted-foreground">Send reminders for outstanding payments</p>
                      </div>
                      <Switch 
                        checked={settings.notification_settings.payment_reminders}
                        onCheckedChange={(checked) => 
                          updateSettings('notification_settings', { payment_reminders: checked })
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto Invoice Generation</Label>
                        <p className="text-sm text-muted-foreground">Automatically generate invoices when orders are created</p>
                      </div>
                      <Switch 
                        checked={settings.notification_settings.auto_invoice_generation}
                        onCheckedChange={(checked) => 
                          updateSettings('notification_settings', { auto_invoice_generation: checked })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* System Settings */}
            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>System Settings</span>
                  </CardTitle>
                  <CardDescription>General application settings and feature toggles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Maintenance Mode</Label>
                        <p className="text-sm text-muted-foreground">Temporarily disable the application</p>
                      </div>
                      <Switch 
                        checked={settings.system_settings.maintenance_mode}
                        onCheckedChange={(checked) => 
                          updateSettings('system_settings', { maintenance_mode: checked })
                        }
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Online Payments</Label>
                        <p className="text-sm text-muted-foreground">Enable Stripe payment processing</p>
                      </div>
                      <Switch 
                        checked={settings.system_settings.feature_flags.online_payments}
                        onCheckedChange={(checked) => 
                          updateSettings('system_settings', { 
                            feature_flags: {
                              ...settings.system_settings.feature_flags,
                              online_payments: checked
                            }
                          })
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Quote Sharing</Label>
                        <p className="text-sm text-muted-foreground">Allow clients to share quotes via link</p>
                      </div>
                      <Switch 
                        checked={settings.system_settings.feature_flags.quote_sharing}
                        onCheckedChange={(checked) => 
                          updateSettings('system_settings', { 
                            feature_flags: {
                              ...settings.system_settings.feature_flags,
                              quote_sharing: checked
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label>App Name</Label>
                      <Input
                        value={settings.system_settings.app_name}
                        onChange={(e) => updateSettings('system_settings', { app_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Support Email</Label>
                      <Input
                        type="email"
                        value={settings.system_settings.support_email}
                        onChange={(e) => updateSettings('system_settings', { support_email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Terms & Conditions URL</Label>
                    <Input
                      type="url"
                      placeholder="https://prospace.com/terms"
                      value={settings.system_settings.terms_conditions_url}
                      onChange={(e) => updateSettings('system_settings', { terms_conditions_url: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      URL to your terms and conditions that will be linked in agreement forms
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Agreement Document URL</Label>
                    <Input
                      type="url"
                      placeholder="https://prospace.com/agreement (optional)"
                      value={settings.system_settings.agreement_document_url}
                      onChange={(e) => updateSettings('system_settings', { agreement_document_url: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional URL to a hosted agreement document. If empty, will use dynamically generated content.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}