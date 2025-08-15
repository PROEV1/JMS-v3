import { useState, useEffect } from "react";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderSectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function OrderSection({ 
  id, 
  title, 
  icon: Icon, 
  defaultOpen = false,
  forceOpen = false,
  children,
  className 
}: OrderSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Force open if specified
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={forceOpen || isOpen} onOpenChange={forceOpen ? undefined : setIsOpen}>
        <CollapsibleTrigger asChild className={forceOpen ? "cursor-default" : "cursor-pointer"}>
          <CardHeader className="pb-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              {!forceOpen && (
                <ChevronDown 
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} 
                />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface OrderSectionLayoutProps {
  children: React.ReactNode;
}

export function OrderSectionLayout({ children }: OrderSectionLayoutProps) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}