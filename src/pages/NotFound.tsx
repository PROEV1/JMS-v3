
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

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
          className="bg-brand-teal hover:bg-brand-teal-dark text-white px-6 py-3"
        >
          <Home className="h-4 w-4 mr-2" />
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
