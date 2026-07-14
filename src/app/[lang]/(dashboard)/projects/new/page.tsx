"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ArrowLeft, CheckCircle2, Loader2, UploadCloud, Image as ImageIcon, Box, Star } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAsset } from "@/lib/supabase/storage";
import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";

const projectSchema = z.object({
  title: z.string().min(3, "Project title must be at least 3 characters"),
  client_id: z.string().min(1, "Please select a client"),
  location_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["draft", "active", "completed"]),
});

type FileWithPreview = File & { preview: string };

export default function ProjectCreationWizard() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  
  const router = useRouter();
  const { user } = useAuth();
  const { dict, lang } = useTranslation();

  const [clients, setClients] = useState<any[]>([]);
  const [globalMaterials, setGlobalMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [materialCategory, setMaterialCategory] = useState("all");
  const [materialSearch, setMaterialSearch] = useState("");

  // Asset State
  const [beforePhotos, setBeforePhotos] = useState<FileWithPreview[]>([]);
  const [mainBeforeIndex, setMainBeforeIndex] = useState<number>(0);

  const [afterPhotos, setAfterPhotos] = useState<FileWithPreview[]>([]);
  const [mainAfterIndex, setMainAfterIndex] = useState<number>(0);

  const [model3d, setModel3d] = useState<File | null>(null);

  // Hero Selection: stores a reference to a File from beforePhotos or afterPhotos
  const [heroPhotoFile, setHeroPhotoFile] = useState<FileWithPreview | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: cData } = await supabase.from('clients').select('id, name').order('name');
      if (cData) setClients(cData);
      
      const { data: catData } = await supabase.from('material_categories').select('id, name').order('name');
      if (catData) setCategories(catData);
      
      const { data: mData } = await supabase.from('materials').select('*').order('name');
      if (mData) setGlobalMaterials(mData);
    }
    fetchData();
  }, []);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      beforePhotos.forEach(f => URL.revokeObjectURL(f.preview));
      afterPhotos.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, [beforePhotos, afterPhotos]);

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      client_id: "",
      location_url: "",
      status: "draft",
    },
  });

  const handleFiles = (
    e: React.ChangeEvent<HTMLInputElement>, 
    setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>,
    currentFiles: FileWithPreview[]
  ) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => 
        Object.assign(file, { preview: URL.createObjectURL(file) })
      );
      setFiles([...currentFiles, ...newFiles]);
    }
  };

  const removeFile = (
    index: number,
    files: FileWithPreview[],
    setFiles: React.Dispatch<React.SetStateAction<FileWithPreview[]>>,
    mainIndex: number,
    setMainIndex: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const fileToRemove = files[index];
    if (!fileToRemove) return;
    if (heroPhotoFile === fileToRemove) setHeroPhotoFile(null);
    URL.revokeObjectURL(fileToRemove.preview);
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    
    if (mainIndex === index) setMainIndex(0);
    else if (mainIndex > index) setMainIndex(mainIndex - 1);
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const onSubmit = async (values: z.infer<typeof projectSchema>) => {
    setIsSubmitting(true);
    setUploadProgress("Preparing environment...");
    
    try {
      const supabase = createClient();
      const projectId = generateUUID();
      const designId = generateUUID();
      
      // We will map File objects to their uploaded URLs to easily resolve the Hero image
      const fileToUrlMap = new Map<FileWithPreview, string>();

      // 1. Upload Before Photos
      setUploadProgress("Uploading Before Photos...");
      const uploadedBeforeUrls: string[] = [];
      for (let i = 0; i < beforePhotos.length; i++) {
        const file = beforePhotos[i];
        if (!file) continue;
        const url = await uploadAsset(file, `projects/${projectId}/designs/${designId}/before/${Date.now()}_${file.name}`);
        uploadedBeforeUrls.push(url);
        fileToUrlMap.set(file, url);
      }

      // 2. Upload After Photos
      setUploadProgress("Uploading After Photos...");
      const uploadedAfterUrls: string[] = [];
      for (let i = 0; i < afterPhotos.length; i++) {
        const file = afterPhotos[i];
        if (!file) continue;
        const url = await uploadAsset(file, `projects/${projectId}/designs/${designId}/after/${Date.now()}_${file.name}`);
        uploadedAfterUrls.push(url);
        fileToUrlMap.set(file, url);
      }

      // 3. Upload 3D Model
      let modelUrl = null;
      if (model3d) {
        setUploadProgress("Uploading 3D Model...");
        modelUrl = await uploadAsset(model3d, `projects/${projectId}/models/${Date.now()}_${model3d.name}`);
      }

      setUploadProgress("Saving Project Details...");
      
      // Determine hero URL
      const heroUrl = heroPhotoFile ? fileToUrlMap.get(heroPhotoFile) : null;
      
      // Insert Project
      const { error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: projectId,
          title: values.title,
          client_id: values.client_id,
          client_name: clients.find(c => c.id === values.client_id)?.name || "",
          location_url: values.location_url || null,
          status: values.status,
          hero_image_url: heroUrl,
          created_by: user?.id
        }]);

      if (projectError) throw new Error(projectError.message);

      // Insert Design (Initial Iteration)
      setUploadProgress("Creating Design Iteration...");
      const { error: designError } = await supabase
        .from('designs')
        .insert([{
          id: designId,
          project_id: projectId,
          version_name: "Initial Concept",
          model_3d_url: modelUrl,
          before_image_url: uploadedBeforeUrls.length > 0 ? uploadedBeforeUrls[mainBeforeIndex] : null,
          after_image_url: uploadedAfterUrls.length > 0 ? uploadedAfterUrls[mainAfterIndex] : null,
          before_images: uploadedBeforeUrls,
          after_images: uploadedAfterUrls
        }]);

      if (designError) throw new Error(designError.message);
      
      // Insert Project Materials
      if (selectedMaterialIds.length > 0) {
        setUploadProgress("Assigning Materials...");
        const pmPayload = selectedMaterialIds.map(matId => ({
          project_id: projectId,
          material_id: matId
        }));
        
        const { error: pmError } = await supabase.from('project_materials').insert(pmPayload);
        if (pmError) console.error("Failed to link materials:", pmError);
      }
      
      // Redirect to the newly created live project
      router.push(`/${lang}/projects/${projectId}`);
    } catch (err: any) {
      console.error("Failed to create project:", err);
      alert(`Failed to create project.\n\nDatabase Error: ${err?.message || JSON.stringify(err)}\n\nPlease ensure you have run the latest Database SQL script in database_setup.md.`);
      setIsSubmitting(false);
      setUploadProgress("");
    }
  };

  const validateAndNext = async (currentStep: number) => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["title", "client_id"]);
      if (isValid) setStep(2);
    } else if (currentStep === 2) {
      if (beforePhotos.length === 0) {
        if (!confirm("You haven't uploaded any Before photos. Continue anyway?")) return;
      }
      setStep(3);
    } else if (currentStep === 3) {
      if (afterPhotos.length === 0) {
        if (!confirm("You haven't uploaded any After photos. Continue anyway?")) return;
      }
      setStep(4);
    } else if (currentStep === 4) {
      if (!model3d) {
        if (!confirm("You haven't uploaded a 3D model. Continue anyway?")) return;
      }
      setStep(5);
    } else if (currentStep === 5) {
      setStep(6);
    }
  };

  // Combine photos for hero selection
  const heroSelectionPhotos = afterPhotos;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto py-8">
      <Link href={`/${lang}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-180" /> {dict.createProjectWizard?.backToProjects || "Back to Projects"}
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-light tracking-tight mb-2">{dict.createProjectWizard?.title || "Create New Project"}</h2>
        <p className="text-muted-foreground">{dict.createProjectWizard?.description || "Set up the foundation for your next facade design."}</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-4">
        {[
          { num: 1, label: dict.createProjectWizard?.steps?.details || "Details" },
          { num: 2, label: dict.createProjectWizard?.steps?.beforePhotos || "Before Photos" },
          { num: 3, label: dict.createProjectWizard?.steps?.afterPhotos || "After Photos" },
          { num: 4, label: dict.createProjectWizard?.steps?.model3d || "3D Model" },
          { num: 5, label: dict.createProjectWizard?.steps?.materials || "Materials" },
          { num: 6, label: dict.createProjectWizard?.steps?.heroSection || "Hero Section" }
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s.num ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s.num}</div>
              <span className={`text-sm font-medium ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i < 5 && <div className="flex-1 h-px bg-border min-w-[30px]" />}
          </React.Fragment>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form validation failed:", errors);
          alert("Validation failed: Please go back to Step 1 and check your inputs (Title, Client, URL).");
        })}>
          <Card className="shadow-sm border-border bg-card overflow-hidden">
            <CardHeader className="bg-secondary/20 border-b border-border">
              <CardTitle>
                {step === 1 && (dict.createProjectWizard?.stepDescriptions?.['1_title'] || "Project Information")}
                {step === 2 && (dict.createProjectWizard?.stepDescriptions?.['2_title'] || "Site Photos (Before)")}
                {step === 3 && (dict.createProjectWizard?.stepDescriptions?.['3_title'] || "Render Photos (After)")}
                {step === 4 && (dict.createProjectWizard?.stepDescriptions?.['4_title'] || "3D Model")}
                {step === 5 && (dict.createProjectWizard?.stepDescriptions?.['5_title'] || "Select Materials")}
                {step === 6 && (dict.createProjectWizard?.stepDescriptions?.['6_title'] || "Hero Section Cover")}
              </CardTitle>
              <CardDescription>
                {step === 1 && (dict.createProjectWizard?.stepDescriptions?.['1_desc'] || "Define the core details for this project.")}
                {step === 2 && (dict.createProjectWizard?.stepDescriptions?.['2_desc'] || "Upload all photos of the site's current state. Select one to be the main 'Before' image.")}
                {step === 3 && (dict.createProjectWizard?.stepDescriptions?.['3_desc'] || "Upload all architectural renders. Select one to be the main 'After' image.")}
                {step === 4 && (dict.createProjectWizard?.stepDescriptions?.['4_desc'] || "Upload the primary interactive 3D model (.glb file) for the client presentation.")}
                {step === 5 && (dict.createProjectWizard?.stepDescriptions?.['5_desc'] || "Select the finishes and materials used in this project.")}
                {step === 6 && (dict.createProjectWizard?.stepDescriptions?.['6_desc'] || "Select the showcase photo that will appear at the very top of the Client Presentation.")}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              <AnimatePresence mode="wait">
                
                {/* STEP 1: DETAILS (Hidden if not active so values are retained, or we just rely on react-hook-form keeping state) */}
                <div className={step === 1 ? "block" : "hidden"}>
                  <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{dict.createProjectWizard?.form?.projectTitle || "Project Title"}</FormLabel>
                          <FormControl>
                            <Input placeholder={dict.createProjectWizard?.form?.projectTitlePlaceholder || "e.g. Al-Riyadh Corporate Headquarters"} className="bg-secondary/50" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="client_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{dict.createProjectWizard?.form?.client || "Client"}</FormLabel>
                            <select 
                              className="w-full flex h-10 rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              {...field}
                            >
                              <option value="" disabled>{dict.createProjectWizard?.form?.selectClient || "Select a client..."}</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <FormDescription>Select from existing clients.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="location_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{dict.createProjectWizard?.form?.googleMapsUrl || "Google Maps Location URL (Optional)"}</FormLabel>
                            <FormControl>
                              <Input placeholder={dict.createProjectWizard?.form?.googleMapsPlaceholder || "https://maps.google.com/..."} className="bg-secondary/50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </motion.div>
                </div>

                {/* STEP 2: BEFORE PHOTOS */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <label className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-secondary/20 transition-colors cursor-pointer min-h-[200px]">
                      <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" multiple onChange={(e) => handleFiles(e, setBeforePhotos, beforePhotos)} />
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4 text-primary">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-lg mb-1">Click to upload Before photos</p>
                      <p className="text-sm text-muted-foreground">You can upload multiple images.</p>
                    </label>

                    {beforePhotos.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Select Main Before Photo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {beforePhotos.map((file, i) => (
                            <div 
                              key={i} 
                              onClick={() => setMainBeforeIndex(i)}
                              className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${mainBeforeIndex === i ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                            >
                              <img src={file.preview} alt="Before preview" className="w-full h-full object-cover" />
                              {mainBeforeIndex === i && (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium shadow-md">
                                  Main
                                </div>
                              )}
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFile(i, beforePhotos, setBeforePhotos, mainBeforeIndex, setMainBeforeIndex); }}
                                className="absolute bottom-2 right-2 bg-black/50 hover:bg-destructive text-white p-1.5 rounded-md backdrop-blur-sm transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 3: AFTER PHOTOS */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <label className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-secondary/20 transition-colors cursor-pointer min-h-[200px]">
                      <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" multiple onChange={(e) => handleFiles(e, setAfterPhotos, afterPhotos)} />
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4 text-primary">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-lg mb-1">Click to upload After photos</p>
                      <p className="text-sm text-muted-foreground">Upload your renders. You can select multiple.</p>
                    </label>

                    {afterPhotos.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Select Main After Photo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {afterPhotos.map((file, i) => (
                            <div 
                              key={i} 
                              onClick={() => setMainAfterIndex(i)}
                              className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${mainAfterIndex === i ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                            >
                              <img src={file.preview} alt="After preview" className="w-full h-full object-cover" />
                              {mainAfterIndex === i && (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium shadow-md">
                                  Main
                                </div>
                              )}
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFile(i, afterPhotos, setAfterPhotos, mainAfterIndex, setMainAfterIndex); }}
                                className="absolute bottom-2 right-2 bg-black/50 hover:bg-destructive text-white p-1.5 rounded-md backdrop-blur-sm transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 4: 3D MODEL */}
                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <label className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-secondary/20 transition-colors cursor-pointer min-h-[300px]">
                      <input type="file" className="hidden" accept=".glb" onChange={(e) => setModel3d(e.target.files?.[0] || null)} />
                      
                      {model3d ? (
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                            <Box className="w-8 h-8" />
                          </div>
                          <p className="font-medium text-lg text-foreground">{model3d.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{(model3d.size / 1024 / 1024).toFixed(2)} MB</p>
                          <p className="text-sm text-primary mt-6 hover:underline">Click to change file</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 text-primary">
                            <Box className="w-8 h-8" />
                          </div>
                          <p className="font-medium text-lg mb-1">Upload .GLB 3D Model</p>
                          <p className="text-sm text-muted-foreground">This powers the interactive viewer in the client presentation.</p>
                        </>
                      )}
                    </label>
                  </motion.div>
                )}

                {/* STEP 5: MATERIALS */}
                {step === 5 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    {selectedMaterialIds.length > 0 && (
                      <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                        <p className="text-sm font-medium mb-3">Selected Materials ({selectedMaterialIds.length})</p>
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
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 bg-secondary/30 p-3 rounded-xl border border-border">
                      <div className="flex-1 w-full">
                        <Input 
                          placeholder="Search materials..."
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
                        <option value="all">All Categories</option>
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 pb-4">
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
                      {globalMaterials.length === 0 && (
                        <div className="col-span-2 md:col-span-4 text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                          No materials found in the global library. You can add them later.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* STEP 6: HERO SECTION */}
                {step === 6 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    {heroSelectionPhotos.length === 0 ? (
                      <div className="text-center p-12 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No After photos were uploaded in previous steps.</p>
                        <p className="text-sm">You can skip this step, or go back to upload photos.</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">Select the most impressive shot for the presentation's landing page.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {heroSelectionPhotos.map((file, i) => (
                            <div 
                              key={i} 
                              onClick={() => setHeroPhotoFile(file)}
                              className={`relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${heroPhotoFile === file ? 'border-primary ring-4 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                            >
                              <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                              {heroPhotoFile === file && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[1px]">
                                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-medium shadow-lg flex items-center gap-2">
                                    <Star className="w-4 h-4 fill-current" /> Hero Image
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </CardContent>
            <CardFooter className="bg-secondary/10 border-t border-border p-6 flex justify-between items-center">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
                  {dict.createProjectWizard?.backToProjects ? dict.createProjectWizard.backToProjects.split(" ")[0] : "Back"}
                </Button>
              ) : (
                <div />
              )}
              
              {step < 6 ? (
                <Button type="button" onClick={() => validateAndNext(step)} className="shadow-md">
                  {dict.createProjectWizard?.form?.continue || "Continue"}
                </Button>
              ) : (
                <div className="flex items-center gap-4">
                  {isSubmitting && <span className="text-sm text-muted-foreground animate-pulse">{uploadProgress}</span>}
                  <Button type="submit" disabled={isSubmitting} className="shadow-lg shadow-primary/20">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {uploadProgress || "Saving..."}</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> {dict.createProjectWizard?.form?.createProject || "Create Project"}</>}
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>
    </motion.div>
  );
}
