"use client";

import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";
import { Search, Bell, Globe, Sun, Moon, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { dict, lang } = useTranslation();
  const { theme, setTheme } = useTheme();
  
  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${lang}`, `/${nextLang}`);
    window.location.href = newPath;
  };
  
  // Create a nice page title based on the route
  const getPageTitle = () => {
    // pathname might be /en or /ar or /en/dashboard etc.
    const segments = pathname.split("/").filter(Boolean);
    // Remove language segment if it exists
    const pathSegments = (segments[0] === "en" || segments[0] === "ar") ? segments.slice(1) : segments;
    
    
    if (pathSegments.length === 0) return dict.dashboard?.overview || "Overview";
    const segment = pathSegments[0];
    if (!segment) return "";
    
    // Map common routes to dictionary keys for the title
    if (segment === "projects") return dict.navigation?.projects || "Projects";
    if (segment === "clients") return dict.navigation?.clients || "Clients";
    if (segment === "materials") return dict.navigation?.materials || "Materials";
    if (segment === "gallery") return dict.navigation?.gallery || "Gallery";
    if (segment === "manage-gallery") return dict.manageGallery?.title || "Manage Gallery";
    if (segment === "settings") return dict.navigation?.settings || "Settings";

    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2 md:gap-4 flex-1">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side={lang === 'ar' ? 'right' : 'left'} className="p-0 w-64 border-none">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Sidebar className="flex w-full" />
          </SheetContent>
        </Sheet>
        
        <h1 className="text-xl font-light tracking-tight hidden md:block">
          {getPageTitle()}
        </h1>
        
        <div className="relative max-w-md w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={dict.header?.searchPlaceholder || "Search projects, clients, or materials..."} 
            className="pl-9 h-9 bg-secondary/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          onClick={toggleLanguage}
          className="rounded-full font-medium text-muted-foreground"
        >
          <Globe className="w-4 h-4 mr-2" />
          {lang === 'ar' ? 'En' : 'عربي'}
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-muted-foreground"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />
        </Button>
      </div>
    </header>
  );
}
