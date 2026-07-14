import { toast } from "sonner";
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/providers/translation-provider";
import { uploadAsset } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Layers, Image as ImageIcon, Loader2, Trash2, Edit2 } from "lucide-react";

type Material = {
  id: string;
  name: string;
  category: string;
  image_url: string;
  size: string;
  color: string;
  description: string;
};

type MaterialCategory = {
  id: string;
  name: string;
};

export default function MaterialsPage() {
  const { dict } = useTranslation();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    id: "",
    name: "",
    category: "",
    size: "",
    color: "",
    description: "",
    image_url: "",
  });
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const supabase = createClient();
    
    const { data: catData } = await supabase.from("material_categories").select("*").order("name");
    if (catData) setCategories(catData);

    const { data, error } = await supabase.from("materials").select("*").order("name");
    if (!error && data) {
      setMaterials(data);
    }
    setIsLoading(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("material_categories").insert([{ name: newCategoryName }]);
      if (error) throw error;
      setNewCategoryName("");
      fetchMaterials();
    } catch (error: any) {
      toast.error("Failed to add category: " + error.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure? Materials using this category will still exist but might lose their filter association.")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("material_categories").delete().eq("id", id);
      if (error) throw error;
      fetchMaterials();
    } catch (error: any) {
      toast.error("Failed to delete category: " + error.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileToUpload(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setForm({ id: "", name: "", category: categories.length > 0 ? categories[0]?.name || "" : "", size: "", color: "", description: "", image_url: "" });
    setFileToUpload(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const supabase = createClient();
      let finalImageUrl = form.image_url;

      // Upload image if selected
      if (fileToUpload) {
        finalImageUrl = await uploadAsset(fileToUpload, `materials/${Date.now()}_${fileToUpload.name}`);
      }

      const payload = {
        name: form.name,
        category: form.category,
        size: form.size,
        color: form.color,
        description: form.description,
        image_url: finalImageUrl
      };

      if (form.id) {
        // Update
        const { error } = await supabase.from("materials").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from("materials").insert([payload]);
        if (error) throw error;
      }

      await fetchMaterials();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error("Error saving material: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
      setMaterials(materials.filter(m => m.id !== id));
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const editMaterial = (mat: Material) => {
    setForm({
      id: mat.id,
      name: mat.name || "",
      category: mat.category || (categories.length > 0 ? categories[0]?.name || "" : ""),
      size: mat.size || "",
      color: mat.color || "",
      description: mat.description || "",
      image_url: mat.image_url || ""
    });
    setPreviewUrl(mat.image_url || null);
    setIsDialogOpen(true);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name?.toLowerCase().includes(search.toLowerCase()) || m.color?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight mb-2">{dict.materials?.title || "Materials Library"}</h1>
          <p className="text-muted-foreground text-lg">{dict.materials?.description || "Manage all global finishes and materials available for projects."}</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">{dict.materials?.manageCategories || "Manage Categories"}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Material Categories</DialogTitle>
                <DialogDescription>Add or remove categories for your materials.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <Input 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)} 
                    placeholder="New category name..." 
                  />
                  <Button type="submit">Add</Button>
                </form>
                
                <div className="border border-border rounded-md overflow-hidden max-h-[250px] overflow-y-auto">
                  {categories.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No categories yet.</div>
                  ) : (
                    categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-3 border-b border-border bg-secondary/10 last:border-0">
                        <span className="font-medium text-sm">{cat.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
            else if (!form.id && categories.length > 0) setForm(prev => ({...prev, category: categories[0]?.name || ""}));
          }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20 bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                {dict.materials?.addMaterial || "Add Material"}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit Material" : "Add New Material"}</DialogTitle>
                <DialogDescription>Define the material properties so they can be assigned to projects.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                {/* Photo Upload */}
                <div className="flex justify-center mb-4">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 group bg-secondary/20 relative"
                  >
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                          Change
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground p-2">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <span className="text-xs">Upload Photo</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Material Name</Label>
                    <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Carrara White Marble" />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Category</Label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Size / Dimensions</Label>
                    <Input value={form.size} onChange={e => setForm({...form, size: e.target.value})} placeholder="e.g. 60x120 cm" />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Color</Label>
                    <Input value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="e.g. White with grey veins" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Description (Optional)</Label>
                    <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Premium grade italian marble..." />
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Material
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-secondary/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={dict.materials?.searchMaterials || "Search materials by name or color..."} 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <select 
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[200px]"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="all">{dict.materials?.allCategories || "All Categories"}</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" /></div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-foreground">No materials found.</p>
          <p className="text-sm">Adjust your filters or add a new material.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredMaterials.map(mat => (
            <div key={mat.id} className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
              <div className="aspect-[4/3] bg-secondary/50 relative overflow-hidden">
                {mat.image_url ? (
                  <img src={mat.image_url} alt={mat.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8 opacity-20" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-background/80 backdrop-blur-md text-foreground text-[10px] px-2 py-1 rounded-full font-medium border border-border/50 uppercase tracking-wide">
                    {mat.category || "Uncategorized"}
                  </span>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => editMaterial(mat)} className="p-1.5 bg-background/90 text-foreground rounded-md shadow-sm hover:bg-primary hover:text-primary-foreground backdrop-blur-md transition-colors"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => deleteMaterial(mat.id)} className="p-1.5 bg-background/90 text-destructive rounded-md shadow-sm hover:bg-destructive hover:text-white backdrop-blur-md transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-lg leading-tight truncate" title={mat.name}>{mat.name}</h3>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/50">
                  <div className="truncate" title={mat.size}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{dict.materials?.size || "Size"}</span>
                    {mat.size || "—"}
                  </div>
                  <div className="truncate" title={mat.color}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{dict.materials?.color || "Color"}</span>
                    {mat.color || "—"}
                  </div>
                </div>
                
                {mat.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {mat.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
