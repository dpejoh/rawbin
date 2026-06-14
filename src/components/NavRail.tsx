import { useState } from 'react';
import { Key, Clipboard, Folder, ListChecks, Puzzle, Smartphone, Globe, Shield, LogOut, Code2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Page } from '../App';
import type { UserRole } from '../hooks/useAuth';

interface NavRailProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  userInitials: string;
  onSignOut: () => void;
  role: UserRole;
}

const navItems: { id: Page; icon: React.ReactNode; label: string }[] = [
  { id: 'keybox', icon: <Key className="size-5" />, label: 'Keyboxes' },
  { id: 'clipboards', icon: <Clipboard className="size-5" />, label: 'Boards' },
  { id: 'files', icon: <Folder className="size-5" />, label: 'Files' },
  { id: 'apps', icon: <ListChecks className="size-5" />, label: 'Apps' },
  { id: 'modules', icon: <Puzzle className="size-5" />, label: 'Modules' },
  { id: 'apks', icon: <Smartphone className="size-5" />, label: 'APKs' },
];

export default function NavRail({ activePage, onNavigate, userInitials, onSignOut, role }: NavRailProps) {
  const items = role === 'admin'
    ? [...navItems, { id: 'instances' as Page, icon: <Globe className="size-5" />, label: 'Instances' }, { id: 'roles' as Page, icon: <Shield className="size-5" />, label: 'Roles' }]
    : navItems;

  return (
    <div className="flex flex-col items-center w-20 h-screen bg-card border-r py-4 justify-between">
      <div className="flex flex-col items-center gap-1">
        <Code2 className="size-5 text-primary" />
        <span className="text-[10px] text-muted-foreground tracking-wider uppercase">rawbin</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        {items.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {item.icon}
              <span className={`text-[11px] font-medium leading-tight ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="outline-none">
              <Avatar className="size-9 cursor-pointer bg-primary text-primary-foreground text-sm font-medium">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right">
            <DropdownMenuLabel className="capitalize">{role}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="size-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="size-1.5 rounded-full bg-green-500" />
      </div>
    </div>
  );
}
