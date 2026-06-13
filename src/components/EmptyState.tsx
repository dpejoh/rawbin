import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}
