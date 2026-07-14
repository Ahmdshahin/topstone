"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Settings, 
  LogOut,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { dict, lang } = useTranslation();

  // Strip lang prefix for active state matching
  const activePath = pathname.replace(/^\/[a-z]{2}/, "") || "/";

  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${lang}`, `/${nextLang}`);
    window.location.href = newPath;
  };

  const navItems = [
    { name: dict.navigation.dashboard, href: `/${lang}`, icon: LayoutDashboard },
    { name: dict.navigation.projects, href: `/${lang}/projects`, icon: FolderKanban },
    { name: dict.navigation.materials, href: `/${lang}/materials`, icon: Layers },
    { name: dict.navigation.clients, href: `/${lang}/clients`, icon: Users },
    { name: dict.navigation.gallery, href: `/${lang}/manage-gallery`, icon: ImageIcon },
    { name: dict.navigation.settings, href: `/${lang}/settings`, icon: Settings },
  ];

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <aside className={cn("w-64 border-r border-border bg-card flex flex-col h-screen", className || "hidden md:flex")}>
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link href={`/${lang}`} className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80">
          <img 
            src="https://topstone.ae/wp-content/uploads/2020/04/top-stone-square-logo-60.png" 
            alt="Top Stone Logo" 
            className="w-8 h-8 object-contain rounded-sm"
          />
          <span className="font-semibold tracking-tight text-sm uppercase">Top Stone</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hrefNoLang = item.href.replace(/^\/[a-z]{2}/, "");
          const isActive = activePath === hrefNoLang || (hrefNoLang !== "/" && activePath.startsWith(hrefNoLang));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 me-3 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-secondary/50">
          <Avatar className="w-9 h-9 border border-border">
            <AvatarFallback className="bg-background text-xs">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {profile?.role ? profile.role.replace("_", " ") : "Loading..."}
            </p>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
