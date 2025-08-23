import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, FileText, Users, Zap } from 'lucide-react';

export default function AdminSurveyFormGuide() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Survey Form Builder Guide</h1>
        <p className="text-lg text-muted-foreground">
          Learn how to create and manage dynamic survey forms for your clients
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">1. Create a Form</h3>
              <p className="text-sm text-muted-foreground">
                Navigate to Survey Forms and click "Create Form". Start with the EV Install template or build from scratch.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">2. Design Your Steps</h3>
              <p className="text-sm text-muted-foreground">
                Add steps to organize your survey. Each step can contain multiple fields and has its own title and description.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">3. Add Fields</h3>
              <p className="text-sm text-muted-foreground">
                Use the field palette to add different input types like text, photos, videos, dropdowns, and more.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Field Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Available Field Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Badge variant="outline">Text Input</Badge>
              <Badge variant="outline">Long Text</Badge>
              <Badge variant="outline">Number</Badge>
              <Badge variant="outline">Currency</Badge>
              <Badge variant="outline">Email</Badge>
              <Badge variant="outline">Phone</Badge>
              <Badge variant="outline">Dropdown</Badge>
              <Badge variant="outline">Multi-select</Badge>
              <Badge variant="outline">Radio Cards</Badge>
              <Badge variant="outline">Checkbox</Badge>
              <Badge variant="outline">Date</Badge>
              <Badge variant="outline">Time</Badge>
              <Badge variant="outline">Photo Upload</Badge>
              <Badge variant="outline">Video Upload</Badge>
              <Badge variant="outline">File Upload</Badge>
              <Badge variant="outline">Address</Badge>
              <Badge variant="outline">Signature</Badge>
              <Badge variant="outline">GPS Location</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Publishing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Publishing & Mapping
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">1. Publish Your Form</h3>
              <p className="text-sm text-muted-foreground">
                Once your form is complete, publish it to make it available for mapping. Published forms become immutable.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">2. Map to Context</h3>
              <p className="text-sm text-muted-foreground">
                Go to Form Mappings to assign your published form to Direct Orders or Partner Orders.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">3. Automatic Emails</h3>
              <p className="text-sm text-muted-foreground">
                Once mapped, clients automatically receive survey emails based on your form configuration.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Keep It Simple</h3>
              <p className="text-sm text-muted-foreground">
                Use clear field labels and help text. Break complex forms into logical steps.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Validate Requirements</h3>
              <p className="text-sm text-muted-foreground">
                Use the preview feature to test your form before publishing. Check required field validations.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Plan Media Requirements</h3>
              <p className="text-sm text-muted-foreground">
                Set appropriate minimum photo/video counts and file size limits for your use case.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
              <div>
                <h3 className="font-medium">Client Receives Email</h3>
                <p className="text-sm text-muted-foreground">
                  After quote acceptance (Direct) or job creation (Partner), client gets survey email with unique link
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">2</div>
              <div>
                <h3 className="font-medium">Client Completes Survey</h3>
                <p className="text-sm text-muted-foreground">
                  Client fills out your dynamic form with progress saving and validation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">3</div>
              <div>
                <h3 className="font-medium">Admin Reviews</h3>
                <p className="text-sm text-muted-foreground">
                  Order status updates to "Awaiting Survey Review" and admin can approve or request rework
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">4</div>
              <div>
                <h3 className="font-medium">Installation Proceeds</h3>
                <p className="text-sm text-muted-foreground">
                  Once approved, order progresses to scheduling and installation phases
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}