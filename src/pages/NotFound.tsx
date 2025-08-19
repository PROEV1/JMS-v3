
import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const NotFound = () => {
  const location = useLocation();
  const { loading: roleLoading } = useUserRole();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a debounced warning that only logs after role loading is complete
    timeoutRef.current = setTimeout(() => {
      // Only log if role loading has finished (indicating this isn't a transient render)
      if (!roleLoading) {
        console.warn(
          "404 Warning: User on non-existent route after auth resolution:",
          location.pathname
        );
      }
    }, 700);

    // Cleanup timeout on unmount or path change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, roleLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="brand-gradient-teal p-8 rounded-2xl shadow-lg mb-8">
          <h1 className="text-6xl font-bold mb-4 text-white brand-heading-1">404</h1>
          <h2 className="text-2xl text-white brand-heading-2 mb-4">Page Not Found</h2>
        </div>
        
        <p className="text-lg text-muted-foreground mb-8 brand-body">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Button 
          onClick={() => window.location.href = "/"} 
          className="bg-primary hover:bg-[hsl(var(--primary-hover))] text-white px-6 py-3"
        >
          <Home className="h-4 w-4 mr-2" />
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
