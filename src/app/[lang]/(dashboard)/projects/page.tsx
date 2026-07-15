"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, FileImage, FolderKanban } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/providers/translation-provider";
import { format } from "date-fns";

type Project = {
  id: string;
  title: string;
  client_name: string;
  status: string;
  created_at: string;
  share_token: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { dict, lang } = useTranslation();

  useEffect(() => {
    async function fetchProjects() {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setProjects(data);
      }
      setIsLoading(false);
    }
    fetchProjects();
  }, [lang]);

  const handleDelete = async (id: string) => {
    if (!confirm(dict.project?.deleteConfirm || "Are you sure you want to delete this project? This will permanently delete the project and all its uploaded files (3D models, photos).")) return;
    
    try {
      const supabase = createClient();

      // 1. Fetch project and designs to gather file URLs
      const { data: project } = await supabase.from('projects').select('hero_image_url').eq('id', id).single();
      const { data: designs } = await supabase.from('designs').select('model_3d_url, before_images, after_images').eq('project_id', id);

      const urlsToDelete: string[] = [];
      if (project?.hero_image_url) urlsToDelete.push(project.hero_image_url);
      
      if (designs) {
        designs.forEach(d => {
          if (d.model_3d_url) urlsToDelete.push(d.model_3d_url);
          if (d.before_images) urlsToDelete.push(...d.before_images);
          if (d.after_images) urlsToDelete.push(...d.after_images);
        });
      }

      // 2. Convert public URLs to storage paths (removing the base URL part)
      // Supabase public URL looks like: https://[project].supabase.co/storage/v1/object/public/assets/projects/...
      const pathsToDelete = urlsToDelete
        .filter(url => url && url.includes('/assets/'))
        .map(url => {
          const parts = url.split('/assets/');
          return parts.length > 1 ? parts[1] : null;
        })
        .filter(Boolean) as string[];

      // 3. Delete files from storage
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('assets').remove(pathsToDelete);
        if (storageError) console.error("Error deleting files:", storageError);
      }

      // 4. Delete the project from DB
      const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      
      // If count is 0, RLS blocked it
      if (count === 0) {
        throw new Error("You do not have permission to delete this project, or it was already deleted. Please run the provided SQL script.");
      }
      
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error("Failed to delete project: " + err.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light tracking-tight">{dict.project?.title || "Projects"}</h2>
          <p className="text-muted-foreground">{dict.project?.description || "Manage facade designs and client presentations."}</p>
        </div>
        <Link href={`/${lang}/projects/new`}>
          <Button className="rounded-full shadow-sm hover:shadow transition-all bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            {dict.project?.new || "Create Project"}
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={dict.project?.searchProjects || "Search projects by name or client..."} 
              className="pl-9 bg-background border-none focus-visible:ring-1"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">{dict.project?.details || "Project Details"}</TableHead>
                <TableHead>{dict.project?.client || "Client"}</TableHead>
                <TableHead>{dict.project?.statusLabel || "Status"}</TableHead>
                <TableHead className="text-right">{dict.project?.createdAt || "Created At"}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading projects...</TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors">
                          <FileImage className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <Link href={`/${lang}/projects/${project.id}`} className="hover:underline">
                          {project.title}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{project.client_name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs bg-secondary/50">
                        {project.status === 'completed' ? (dict.project?.status?.completed || "completed") :
                         project.status === 'active' ? (dict.project?.status?.active || "active") :
                         (dict.project?.status?.draft || "draft")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(project.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/${lang}/projects/${project.id}`}>
                              {dict.manageGallery?.edit || "Edit"}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/${lang}/p/${project.share_token}`} target="_blank">
                              {dict.gallery?.viewPresentation || "View Presentation"}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:bg-destructive/10"
                            onClick={() => handleDelete(project.id)}
                          >
                            {dict.manageGallery?.delete || "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {projects.length === 0 && !isLoading && (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FolderKanban className="w-8 h-8 opacity-20" />
            <p>{dict.project?.noProjects || "No projects found."}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
