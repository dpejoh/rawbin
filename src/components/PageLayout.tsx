import type { ReactNode, HTMLAttributes } from 'react';

interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  count?: string | number;
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  full: '',
};

export default function PageLayout({ title, description, count, maxWidth = 'md', actions, children, className, compact, ...props }: PageLayoutProps) {
  return (
    <div className={`${compact ? 'p-4' : 'p-8'} flex flex-col h-full box-border ${maxWidthClasses[maxWidth]} ${className ?? ''}`} {...props}>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {count !== undefined ? `${count} · ${description}` : description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
