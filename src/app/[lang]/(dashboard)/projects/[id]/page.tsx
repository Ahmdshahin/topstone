import { toast } from "sonner";
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, Image as ImageIcon, CheckCircle2, ChevronRight, Share2, Eye, EyeOff, MapPin, User, Calendar, Link as LinkIcon, Ruler, Upload, Box, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import React, { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { uploadAsset } from "@/lib/supabase/storage";
import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";
import { logger } from "@/lib/logger";
import { format, formatDistanceToNow } from "date-fns";

type Project = {
  id: string;
  title: string;
  client_name: string;
  status: string;
  created_at: string;
  share_token: string;
  description: string;
  location_url?: string;
  client_id?: string;
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { dict, lang } = useTranslation();
  
  const [project, setProject] = useState<Project | null>(null);
  const [designs, setDesigns] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", client_name: "", client_id: "", description: "", status: "", location_url: "", hero_image_url: "", show_in_gallery: false });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Photo selection dialogs
  const [isBeforePhotoDialogOpen, setIsBeforePhotoDialogOpen] = useState(false);
  const [isAfterPhotoDialogOpen, setIsAfterPhotoDialogOpen] = useState(false);
  
  // Materials Assignment States
  const [isAssignMaterialsOpen, setIsAssignMaterialsOpen] = useState(false);
  const [globalMaterials, setGlobalMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialCategory, setMaterialCategory] = useState("all");
  const [isSavingMaterials, setIsSavingMaterials] = useState(false);
  
  // Active design state
  const activeDesign = designs.length > 0 ? designs[0] : null;
  const [price, setPrice] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchProjectData() {
      const supabase = createClient();
      
      // Fetch project details
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectData) {
        setProject(projectData);
        setEditForm({
          title: projectData.title,
          client_name: projectData.client_name || "",
          client_id: projectData.client_id || "",
          description: projectData.description || "",
          status: projectData.status,
          location_url: projectData.location_url || "",
          hero_image_url: projectData.hero_image_url || "",
          show_in_gallery: projectData.metadata?.show_in_gallery || false
        });
        
        // Fetch clients for the dropdown
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .order('name');
        if (clientsData) setClients(clientsData);
        
        // Fetch existing designs/models
        const { data: designsData } = await supabase
          .from('designs')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false });
          
        if (designsData && designsData.length > 0) {
          setDesigns(designsData);
          setPrice(designsData[0].price || "");
          
          // Fetch assigned materials for this project
          const { data: pmData } = await supabase
            .from("project_materials")
            .select("materials(*)")
            .eq("project_id", id);
          
          if (pmData) {
            const validMats = pmData.map((pm: any) => pm.materials).filter(Boolean);
            setMaterials(validMats);
          }
        }
        
        // Fetch recent activity
        const { data: logsData } = await supabase
          .from('system_logs')
          .select('*')
          .contains('metadata', { projectId: id })
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (logsData) {
          setRecentActivity(logsData);
        }
      }
      setIsLoading(false);
    }
    fetchProjectData();
    
    // Fetch global materials library for the assignment modal
    async function fetchLibrary() {
      const supabase = createClient();
      const { data: mats } = await supabase.from('materials').select('*');
      if (mats) setGlobalMaterials(mats);
      const { data: cats } = await supabase.from('material_categories').select('*');
      if (cats) setCategories(cats);
    }
    fetchLibrary();
  }, [id]);

  // Upload main 3D model
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    logger.info("Started 3D Model Upload", { fileName: file.name, fileSize: file.size, projectId: id });
    
    try {
      const publicUrl = await uploadAsset(file, `projects/${id}/models`);
      const supabase = createClient();
      const { data, error } = await supabase.from('designs').insert({
        project_id: id,
        version_name: file.name,
        model_3d_url: publicUrl
      }).select().single();

      if (error) throw error;

      setDesigns([data, ...designs]);
      logger.info("Successfully completed 3D Model Upload", { designId: data.id, projectId: id });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Since a new design was added, clear the price
      setPrice("");
      setMaterials([]);
    } catch (error: any) {
      logger.error("Upload failed", { error, projectId: id });
      console.error("Upload failed:", error);
      toast.error("Failed to upload model.");
    } finally {
      setIsUploading(false);
    }
  };

  // Upload Before/After images
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'before_image_url' | 'after_image_url') => {
    if (!activeDesign) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSavingDetails(true);
    try {
      const publicUrl = await uploadAsset(file, `projects/${id}/designs/${activeDesign.id}/${field}`);
      
      // Also add the new image to the array of images so it can be selected later
      const arrayField = field === 'before_image_url' ? 'before_images' : 'after_images';
      const existingImages = activeDesign[arrayField] || [];
      const updatedImages = [...existingImages, publicUrl];

      const supabase = createClient();
      await supabase
        .from('designs')
        .update({ 
          [field]: publicUrl,
          [arrayField]: updatedImages
        })
        .eq('id', activeDesign.id);

      // Update local state
      const newDesigns = [...designs];
      newDesigns[0] = { 
        ...newDesigns[0], 
        [field]: publicUrl,
        [arrayField]: updatedImages
      };
      setDesigns(newDesigns);
      
      logger.info(`Uploaded ${field}`, { designId: activeDesign.id, projectId: id });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
      
      // Close dialogs if open
      setIsBeforePhotoDialogOpen(false);
      setIsAfterPhotoDialogOpen(false);
    } catch (error) {
      logger.error(`Failed to upload ${field}`, { error });
      toast.error("Upload failed.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSelectExistingImage = async (url: string, field: 'before_image_url' | 'after_image_url') => {
    if (!activeDesign) return;
    setIsSavingDetails(true);
    try {
      const supabase = createClient();
      await supabase
        .from('designs')
        .update({ [field]: url })
        .eq('id', activeDesign.id);

      const newDesigns = [...designs];
      newDesigns[0] = { ...newDesigns[0], [field]: url };
      setDesigns(newDesigns);
      
      setIsBeforePhotoDialogOpen(false);
      setIsAfterPhotoDialogOpen(false);
      
      logger.info(`Selected existing image for ${field}`, { designId: activeDesign.id, projectId: id });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
    } catch (error) {
      console.error(error);
      toast.error("Failed to select image.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .update({
          title: editForm.title,
          client_name: editForm.client_name,
          client_id: editForm.client_id || null,
          description: editForm.description,
          status: editForm.status,
          location_url: editForm.location_url || null,
          hero_image_url: editForm.hero_image_url || null,
          metadata: { ...(project as any)?.metadata, show_in_gallery: editForm.show_in_gallery }
        })
        .eq('id', id)
        .select();
        
      if (error) throw error;
      if (data && data.length > 0) {
        setProject(data[0]);
      }
      setIsEditDialogOpen(false);
      
      logger.info("Project details updated", { projectId: id });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
    } catch (error: any) {
      logger.error("Failed to update project", { error, projectId: id, editForm });
      console.error("Failed to update project", error);
      toast.error("Failed to update project. Error: " + (error?.message || JSON.stringify(error)));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const saveCommercialDetails = async () => {
    if (!activeDesign) return;
    setIsSavingDetails(true);
    try {
      const supabase = createClient();
      await supabase
        .from('designs')
        .update({ 
          price: price
        })
        .eq('id', activeDesign.id);
      
      logger.info("Saved design details", { designId: activeDesign.id, projectId: id });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
      
      toast.success("Commercial details saved successfully!");
    } catch (error) {
      logger.error("Failed to save details", { error });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveAssignedMaterials = async () => {
    setIsSavingMaterials(true);
    try {
      const supabase = createClient();
      
      // Delete existing assignments for this project
      await supabase.from('project_materials').delete().eq('project_id', id);
      
      // Insert new assignments
      if (selectedMaterialIds.length > 0) {
        const inserts = selectedMaterialIds.map(matId => ({
          project_id: id,
          material_id: matId
        }));
        const { error } = await supabase.from('project_materials').insert(inserts);
        if (error) throw error;
      }
      
      // Update local state
      const selectedMats = globalMaterials.filter(m => selectedMaterialIds.includes(m.id));
      setMaterials(selectedMats);
      setIsAssignMaterialsOpen(false);
      
      logger.info("Assigned materials to project", { projectId: id, count: selectedMaterialIds.length });
      
      // Fetch updated logs
      const { data: newLogs } = await supabase.from('system_logs').select('*').contains('metadata', { projectId: id }).order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentActivity(newLogs);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to assign materials: " + err.message);
    } finally {
      setIsSavingMaterials(false);
    }
  };

  if (isLoading) {
    return <div className="py-24 text-center text-muted-foreground">{dict.projectDetails.loadingProjectDetails}</div>;
  }

  if (!project) {
    return <div className="py-24 text-center text-destructive">{dict.projectDetails.projectNotFound}</div>;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link href={`/${lang}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-180" /> {dict.navigation.projects}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight">{project.title}</h2>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{project.status}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {project.location_url ? (
              <a href={project.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <MapPin className="w-4 h-4" /> {dict.projectDetails.viewOnMap}
              </a>
            ) : (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {dict.projectDetails.notSpecified}</span>
            )}
            <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {project.client_name}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {dict.projectDetails.created}: {format(new Date(project.created_at), "MMM d, yyyy")}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">Edit Project</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>{dict.projectDetails.updateCoreDetails}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>{dict.projectDetails.projectTitle}</Label>
                  <Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>{dict.projectDetails.client}</Label>
                  <select 
                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={editForm.client_id}
                    onChange={e => {
                      const selected = clients.find(c => c.id === e.target.value);
                      setEditForm({
                        ...editForm, 
                        client_id: e.target.value,
                        client_name: selected ? selected.name : ""
                      });
                    }}
                  >
                    <option value="" disabled>{dict.projectDetails.selectClient}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{dict.projectDetails.status}</Label>
                  <select 
                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={editForm.status} 
                    onChange={e => setEditForm({...editForm, status: e.target.value})}
                  >
                    <option value="draft">{dict.projectDetails.draft}</option>
                    <option value="active">{dict.projectDetails.inProgress}</option>
                    <option value="completed">{dict.projectDetails.completed}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{dict.projectDetails.scopeDescription}</Label>
                  <Input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>{dict.projectDetails.googleMapsUrl}</Label>
                  <Input value={editForm.location_url} onChange={e => setEditForm({...editForm, location_url: e.target.value})} placeholder="https://maps.google.com/..." />
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="show-gallery" 
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={editForm.show_in_gallery}
                    onChange={(e) => setEditForm({ ...editForm, show_in_gallery: e.target.checked })}
                  />
                  <Label htmlFor="show-gallery" className="cursor-pointer">
                    Show in Public Gallery (if completed)
                  </Label>
                </div>
                
                <div className="space-y-2">
                  <Label>{dict.projectDetails.heroImage}</Label>
                  <div className="grid grid-cols-2 gap-2">
                     {activeDesign?.before_image_url && (
                       <div 
                         className={`relative aspect-video rounded-md overflow-hidden border-2 cursor-pointer ${editForm.hero_image_url === activeDesign.before_image_url ? 'border-primary' : 'border-border'}`}
                         onClick={() => setEditForm({...editForm, hero_image_url: activeDesign.before_image_url})}
                       >
                         <img src={activeDesign.before_image_url} className="w-full h-full object-cover" />
                         <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center font-medium backdrop-blur-sm">{dict.projectDetails.sitePhoto}</div>
                       </div>
                     )}
                     {activeDesign?.after_image_url && (
                       <div 
                         className={`relative aspect-video rounded-md overflow-hidden border-2 cursor-pointer ${editForm.hero_image_url === activeDesign.after_image_url ? 'border-primary' : 'border-border'}`}
                         onClick={() => setEditForm({...editForm, hero_image_url: activeDesign.after_image_url})}
                       >
                         <img src={activeDesign.after_image_url} className="w-full h-full object-cover" />
                         <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center font-medium backdrop-blur-sm">{dict.projectDetails.finalRender}</div>
                       </div>
                     )}
                  </div>
                  {!activeDesign?.before_image_url && !activeDesign?.after_image_url && (
                    <p className="text-xs text-muted-foreground italic">{dict.projectDetails.uploadImagesFirst}</p>
                  )}
                  {editForm.hero_image_url && (
                    <Button variant="ghost" size="sm" onClick={() => setEditForm({...editForm, hero_image_url: ""})} className="mt-1 text-muted-foreground h-auto py-1 px-2 text-xs">
                      {dict.projectDetails.clearSelection}
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{dict.projectDetails.cancel}</Button>
                <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Link href={`/${lang}/p/${project.share_token}`} target="_blank">
            <Button className="shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
              {dict.projectDetails.openPresentation}
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:w-[900px] bg-secondary/50 p-1 rounded-xl h-auto gap-1">
          <TabsTrigger value="overview" className="rounded-lg py-2">{dict.projectDetails.overview}</TabsTrigger>
          <TabsTrigger value="measurements" className="rounded-lg py-2">{dict.projectDetails.measurements}</TabsTrigger>
          <TabsTrigger value="designs" className="rounded-lg py-2">{dict.projectDetails.designs}</TabsTrigger>
          <TabsTrigger value="visuals" className="rounded-lg py-2">{dict.projectDetails.visualAssets}</TabsTrigger>
          <TabsTrigger value="commercials" className="rounded-lg py-2">{dict.projectDetails.commercials}</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-lg py-2">{dict.projectDetails.materials}</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card className="shadow-sm border-border mb-6">
            <CardHeader>
              <CardTitle>{dict.projectDetails.clientAccess}</CardTitle>
              <CardDescription>{dict.projectDetails.clientAccessDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1 w-full">
                  <label className="text-sm font-medium">{dict.projectDetails.publicLink}</label>
                  <Input readOnly value={`${window.location.origin}/${lang}/p/${project.share_token}`} className="bg-secondary/50 font-mono text-sm" />
                </div>
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${lang}/p/${project.share_token}`)}>
                  <LinkIcon className="w-4 h-4 mr-2" /> {dict.projectDetails.copyLink}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-2 shadow-sm border-border">
              <CardHeader>
                <CardTitle>{dict.projectDetails.projectScope}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {project.description || "No description provided for this project yet. Add a scope of work to help the team understand the architectural goals."}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">{dict.projectDetails.salesEngineer}</p>
                    <p className="font-medium">Ahmed Al-Sayed</p>
                  </div>
                  <div className="p-4 bg-secondary/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">{dict.projectDetails.leadDesigner}</p>
                    <p className="font-medium">Sarah Jenkins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>{dict.projectDetails.recentActivity}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{dict.projectDetails.noRecentActivity}</p>
                  ) : (
                    recentActivity.map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${log.level === 'error' ? 'bg-destructive' : 'bg-primary'}`} />
                        <div>
                          <p className="text-sm font-medium">{log.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Measurements Tab */}
        <TabsContent value="measurements" className="mt-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{dict.projectDetails.siteMeasurements}</CardTitle>
                <CardDescription>{dict.projectDetails.siteMeasurementsDesc}</CardDescription>
              </div>
              <Button variant="outline" size="sm"><Ruler className="w-4 h-4 mr-2" /> {dict.projectDetails.addMeasurement}</Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                No measurements logged yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Designs Tab */}
        <TabsContent value="designs" className="mt-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{dict.projectDetails.designIterations}</CardTitle>
                <CardDescription>{dict.projectDetails.designIterationsDesc}</CardDescription>
              </div>
              
              <div>
                <input 
                  type="file" 
                  accept=".glb" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? dict.projectDetails.uploadingModel : dict.projectDetails.uploadGlbModel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {designs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <Box className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p>{dict.projectDetails.noModels}</p>
                  <p className="text-sm mt-1">{dict.projectDetails.uploadGlbPrompt}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {designs.map((design, index) => (
                    <div key={design.id} className="aspect-square bg-secondary/30 rounded-xl flex flex-col items-center justify-center text-muted-foreground border border-border group relative overflow-hidden">
                      <div className="absolute top-2 right-2">
                        {index === 0 && <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>}
                      </div>
                      <Box className="w-8 h-8 mb-2 text-primary/70" />
                      <span className="text-xs font-medium truncate max-w-[80%] px-2" title={design.version_name}>
                        {design.version_name}
                      </span>
                      <span className="text-[10px] opacity-50 mt-1">
                        {format(new Date(design.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visuals Tab */}
        <TabsContent value="visuals" className="mt-6">
          {!activeDesign ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Box className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>{dict.projectDetails.noActiveDesign}</p>
              <p className="text-sm mt-1">{dict.projectDetails.uploadModelVisuals}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle>{dict.projectDetails.sitePhotoBefore}</CardTitle>
                  <CardDescription>{dict.projectDetails.currentState}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={isBeforePhotoDialogOpen} onOpenChange={setIsBeforePhotoDialogOpen}>
                    <DialogTrigger asChild>
                      <div className="aspect-video relative rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 group transition-colors bg-secondary/20">
                        {activeDesign.before_image_url ? (
                          <>
                            <img src={activeDesign.before_image_url} alt="Before" className="object-cover w-full h-full" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Button variant="secondary" size="sm">{dict.projectDetails.changeImage}</Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6 text-muted-foreground">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{dict.projectDetails.clickUploadSitePhoto}</p>
                          </div>
                        )}
                      </div>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>{dict.projectDetails.selectSitePhoto}</DialogTitle>
                        <DialogDescription>{dict.projectDetails.chooseExisting}</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'before_image_url')} />
                        <Button onClick={() => beforeInputRef.current?.click()} className="w-full mb-6" disabled={isSavingDetails}>
                          {isSavingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          {dict.projectDetails.uploadNewPhoto}
                        </Button>
                        
                        {activeDesign.before_images && activeDesign.before_images.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-3">{dict.projectDetails.orChooseUploaded}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                              {activeDesign.before_images.map((url: string, i: number) => (
                                <div 
                                  key={i}
                                  onClick={() => handleSelectExistingImage(url, 'before_image_url')}
                                  className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${activeDesign.before_image_url === url ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                >
                                  <img src={url} alt={`Before ${i}`} className="w-full h-full object-cover" />
                                  {activeDesign.before_image_url === url && (
                                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle>{dict.projectDetails.renderAfter}</CardTitle>
                  <CardDescription>{dict.projectDetails.highQualityRender}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={isAfterPhotoDialogOpen} onOpenChange={setIsAfterPhotoDialogOpen}>
                    <DialogTrigger asChild>
                      <div className="aspect-video relative rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 group transition-colors bg-secondary/20">
                        {activeDesign.after_image_url ? (
                          <>
                            <img src={activeDesign.after_image_url} alt="After" className="object-cover w-full h-full" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Button variant="secondary" size="sm">{dict.projectDetails.changeImage}</Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6 text-muted-foreground">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{dict.projectDetails.clickUploadRender}</p>
                          </div>
                        )}
                      </div>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>{dict.projectDetails.selectRender}</DialogTitle>
                        <DialogDescription>{dict.projectDetails.chooseExistingRender}</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'after_image_url')} />
                        <Button onClick={() => afterInputRef.current?.click()} className="w-full mb-6" disabled={isSavingDetails}>
                          {isSavingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          {dict.projectDetails.uploadNewPhoto}
                        </Button>
                        
                        {activeDesign.after_images && activeDesign.after_images.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-3">{dict.projectDetails.orChooseRenders}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                              {activeDesign.after_images.map((url: string, i: number) => (
                                <div 
                                  key={i}
                                  onClick={() => handleSelectExistingImage(url, 'after_image_url')}
                                  className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${activeDesign.after_image_url === url ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                >
                                  <img src={url} alt={`After ${i}`} className="w-full h-full object-cover" />
                                  {activeDesign.after_image_url === url && (
                                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Commercials Tab */}
        <TabsContent value="commercials" className="mt-6">
          {!activeDesign ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Box className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>{dict.projectDetails.noActiveDesign}</p>
              <p className="text-sm mt-1">{dict.projectDetails.uploadModelCommercials}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={saveCommercialDetails} disabled={isSavingDetails} size="sm">
                  {isSavingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {dict.projectDetails.saveCommercialDetails}
                </Button>
              </div>
              <Card className="shadow-sm border-border max-w-2xl">
                <CardHeader>
                  <CardTitle>{dict.projectDetails.commercialDetails}</CardTitle>
                  <CardDescription>{dict.projectDetails.commercialDetailsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>{dict.projectDetails.estimatedPrice}</Label>
                    <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="SAR 0.00" className="bg-secondary/50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="mt-6">
          {!activeDesign ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Box className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>{dict.projectDetails.noActiveDesign}</p>
              <p className="text-sm mt-1">{dict.projectDetails.uploadModelMaterials}</p>
            </div>
          ) : (
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{dict.projectDetails.materialsUsed}</CardTitle>
                  <CardDescription>{dict.projectDetails.materialsUsedDesc}</CardDescription>
                </div>
                <Dialog open={isAssignMaterialsOpen} onOpenChange={setIsAssignMaterialsOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setSelectedMaterialIds(materials.map(m => m.id))}><Plus className="w-4 h-4 mr-2" /> {dict.projectDetails.assignMaterials}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>{dict.projectDetails.assignMaterials} to Project</DialogTitle>
                      <DialogDescription>{dict.projectDetails.assignMaterialsDesc}</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
                      {selectedMaterialIds.length > 0 && (
                        <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                          <p className="text-sm font-medium mb-3">{dict.projectDetails.selectedMaterials} ({selectedMaterialIds.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {globalMaterials.filter(m => selectedMaterialIds.includes(m.id)).map(mat => (
                              <div key={`sel-${mat.id}`} className="bg-primary text-primary-foreground pl-3 pr-2 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                                {mat.name}
                                <button onClick={() => setSelectedMaterialIds(selectedMaterialIds.filter(id => id !== mat.id))} className="opacity-70 hover:opacity-100 hover:text-white transition-opacity bg-black/20 rounded-full w-4 h-4 flex items-center justify-center">
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-secondary/30 p-3 rounded-xl border border-border">
                        <div className="flex-1 w-full">
                          <Input 
                            placeholder={dict.projectDetails.searchMaterials}
                            value={materialSearch}
                            onChange={e => setMaterialSearch(e.target.value)}
                            className="bg-background h-9"
                          />
                        </div>
                        <select 
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[200px]"
                          value={materialCategory}
                          onChange={e => setMaterialCategory(e.target.value)}
                        >
                          <option value="all">{dict.projectDetails.allCategories}</option>
                          {categories.map((c: any) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4 pr-2 pb-4">
                        {globalMaterials.filter(m => (materialCategory === "all" || m.category === materialCategory) && m.name.toLowerCase().includes(materialSearch.toLowerCase())).map((mat) => (
                          <div 
                            key={mat.id}
                            onClick={() => {
                              if (selectedMaterialIds.includes(mat.id)) {
                                setSelectedMaterialIds(selectedMaterialIds.filter(id => id !== mat.id));
                              } else {
                                setSelectedMaterialIds([...selectedMaterialIds, mat.id]);
                              }
                            }}
                            className={`relative flex flex-col rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedMaterialIds.includes(mat.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-secondary/10'}`}
                          >
                            <div className="aspect-[4/3] bg-secondary/50 relative">
                              {mat.image_url ? (
                                <img src={mat.image_url} alt={mat.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Box className="w-8 h-8 opacity-20" /></div>
                              )}
                              {selectedMaterialIds.includes(mat.id) && (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-md">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="p-3 text-sm flex-1 flex flex-col">
                              <span className="font-medium line-clamp-1">{mat.name}</span>
                              <span className="text-xs text-muted-foreground uppercase mt-1">{mat.category || 'Uncategorized'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DialogFooter className="mt-4 pt-4 border-t border-border">
                      <Button variant="outline" onClick={() => setIsAssignMaterialsOpen(false)}>{dict.projectDetails.cancel}</Button>
                      <Button onClick={handleSaveAssignedMaterials} disabled={isSavingMaterials}>
                        {isSavingMaterials ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {dict.projectDetails.saveAssignments}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {materials.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    No materials assigned to this project yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {materials.map(mat => (
                      <div key={mat.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/10">
                        <div className="w-16 h-16 rounded-lg bg-secondary flex-shrink-0 overflow-hidden">
                          {mat.image_url ? <img src={mat.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-border" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{mat.name}</h4>
                          <p className="text-sm text-muted-foreground">{mat.description}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive hover:text-white transition-colors"
                          onClick={async () => {
                            if (!confirm(dict.projectDetails.removeMaterialConfirm)) return;
                            try {
                              const supabase = createClient();
                              await supabase.from('project_materials').delete().eq('project_id', id).eq('material_id', mat.id);
                              setMaterials(materials.filter(m => m.id !== mat.id));
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
