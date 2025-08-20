import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SimplePlaceholderProps {
  title: string;
  icon: React.ReactNode;
  description: string;
}

export function SimplePlaceholder({ title, icon, description }: SimplePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <p className="text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Full functionality will be available after TypeScript types regeneration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}