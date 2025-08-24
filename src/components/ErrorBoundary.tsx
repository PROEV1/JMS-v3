import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, Home, MessageCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log error details (no raw stack traces to user)
    console.error(`[ErrorBoundary] ${errorId}:`, {
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString(),
    });

    return {
      hasError: true,
      errorId,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Component stack:`, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorId: '', error: undefined });
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                We couldn't complete that action. Nothing has been lost.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Error ID: {this.state.errorId}
              </p>
              <p className="text-xs text-muted-foreground">
                Please try one of the options below or contact support if the problem persists.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button onClick={this.handleRetry} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={this.handleGoBack} className="flex-1">
                  Go back
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-xs">
                <MessageCircle className="w-3 h-3 mr-1" />
                Contact Support
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}