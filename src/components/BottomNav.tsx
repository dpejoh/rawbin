import { Key, Clipboard, Folder, ListChecks, Puzzle, Smartphone, Shield } from 'lucide-react';
import type { Page } from '../App';
import type { UserRole } from '../hooks/useAuth';

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  role: UserRole;
}

const allActions: { value: Page; label: string; icon: React.ReactNode }[] = [
  { value: 'keybox', label: 'Keyboxes', icon: <Key className="size-5" /> },
  { value: 'clipboards', label: 'Boards', icon: <Clipboard className="size-5" /> },
  { value: 'files', label: 'Files', icon: <Folder className="size-5" /> },
  { value: 'apps', label: 'Apps', icon: <ListChecks className="size-5" /> },
  { value: 'modules', label: 'Modules', icon: <Puzzle className="size-5" /> },
  { value: 'apks', label: 'APKs', icon: <Smartphone className="size-5" /> },
];

export default function BottomNav({ activePage, onNavigate, role }: BottomNavProps) {
  const items = role === 'admin'
    ? [...allActions, { value: 'roles' as Page, label: 'Roles', icon: <Shield className="size-5" /> }]
    : allActions;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
      <nav className="flex">
        {items.map((action) => {
          const isActive = activePage === action.value;
          return (
            <button
              key={action.value}
              onClick={() => onNavigate(action.value)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
