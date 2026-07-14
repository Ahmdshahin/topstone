"use client";

import { Card, CardContent } from "@/components/ui/card";
import { motion } from "motion/react";
import { Globe, Sun, Moon, Image as ImageIcon, FolderKanban } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/providers/translation-provider";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GalleryClientProps {
  projects: any[];
  photos: any[];
}

export function GalleryClient({ projects, photos }: GalleryClientProps) {
  const { lang, dict } = useTranslation();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${lang}`, `/${nextLang}`);
    window.location.href = newPath;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Header */}
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6">
        <Link href={`/${lang}`} className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80">
          <img 
            src="https://topstone.ae/wp-content/uploads/2020/04/top-stone-square-logo-60.png" 
            alt="Top Stone Logo" 
            className="w-8 h-8 object-contain rounded-sm"
          />
          <span className="font-semibold tracking-tight text-lg uppercase hidden sm:inline-block">Top Stone Gallery</span>
        </Link>
        
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-12">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">{dict.gallery?.title || "Our Work"}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {dict.gallery?.description || "Explore our portfolio of completed facade presentations and engineering excellence."}
          </p>
        </div>

        <Tabs defaultValue="projects" className="w-full">
          <div className="flex justify-center md:justify-start mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                {dict.gallery?.tabs?.projects || "Completed Projects"}
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                {dict.gallery?.tabs?.photos || "Photo Gallery"}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="projects" className="mt-0 outline-none">
            {projects.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-xl border-border bg-secondary/20">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">{dict.gallery?.noProjects || "No projects found."}</h3>
                <p className="text-muted-foreground"></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden bg-card border-border hover:shadow-lg transition-all group h-full flex flex-col relative hover:ring-2 hover:ring-primary/50 cursor-pointer">
                      <Link href={`/${lang}/p/${project.share_token}?from=gallery`} className="absolute inset-0 z-10" aria-label={`View ${project.title}`} />
                      
                      <div className="relative aspect-[4/3] bg-secondary overflow-hidden z-0">
                        {project.hero_image_url ? (
                          <Image 
                            src={project.hero_image_url} 
                            alt={project.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-secondary">
                            <ImageIcon className="w-12 h-12 text-muted-foreground opacity-30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <CardContent className="p-6 flex-1 flex flex-col relative z-0">
                        <div className="flex-1">
                          <div className="text-sm font-mono font-bold text-muted-foreground mb-3">
                            Ref: #{project.id.split('-')[0].toUpperCase()}
                          </div>
                          <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                            {project.clients?.name || 'Internal Project'}
                          </div>
                          <h3 className="text-xl font-medium tracking-tight mb-2 group-hover:text-primary transition-colors">
                            {project.title}
                          </h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                              {project.description}
                            </p>
                          )}
                        </div>
                        {project.location_url && (
                          <div className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50 flex items-center gap-1 relative z-20">
                            📍 <a href={project.location_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors hover:underline">View on Google Maps</a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-0 outline-none">
            {photos.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-xl border-border bg-secondary/20">
                <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">{dict.gallery?.noPhotos || "No photos found in the gallery."}</h3>
                <p className="text-muted-foreground"></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden bg-card border-border hover:shadow-lg transition-all group h-full flex flex-col relative hover:ring-2 hover:ring-primary/50 cursor-pointer">
                      <Link href={`/${lang}/photo/${photo.id}?from=gallery`} className="absolute inset-0 z-10" aria-label={`View ${photo.file_name} presentation`} />

                      <div className="relative aspect-[4/3] bg-secondary overflow-hidden z-0">
                        {photo.public_url ? (
                          <Image 
                            src={photo.public_url} 
                            alt={photo.alt_text || photo.file_name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-secondary">
                            <ImageIcon className="w-12 h-12 text-muted-foreground opacity-30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <CardContent className="p-6 flex-1 flex flex-col relative z-0">
                        <div className="flex-1">
                          <div className="text-sm font-mono font-bold text-muted-foreground mb-3">
                            Ref: #{photo.id.split('-')[0].toUpperCase()}
                          </div>
                          <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                            {dict.manageGallery?.photo || "Photo"}
                          </div>
                          <h3 className="text-xl font-medium tracking-tight group-hover:text-primary transition-colors">
                            {photo.caption || photo.file_name}
                          </h3>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
