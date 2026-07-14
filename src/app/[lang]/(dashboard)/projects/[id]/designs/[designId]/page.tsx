"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/providers/translation-provider";
import { createClient } from "@/lib/supabase/client";
import { uploadAsset } from "@/lib/supabase/storage";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PresentationEditorPage({ 
  params 
}: { 
  params: Promise<{ lang: string; id: string; designId: string }> 
}) {
  const { lang, id, designId } = React.use(params);

  const [design, setDesign] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [price, setPrice] = useState("");
  const [timeline, setTimeline] = useState("");

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: designData } = await supabase
        .from("designs")
        .select("*")
        .eq("id", designId)
        .single();

      if (designData) {
        setDesign(designData);
        setPrice(designData.price || "");
        setTimeline(designData.timeline_weeks?.toString() || "");

        const { data: mats } = await supabase
          .from("materials")
          .select("*")
          .eq("design_id", designId);
        
        if (mats) setMaterials(mats);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [designId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'before_image_url' | 'after_image_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const publicUrl = await uploadAsset(file, `projects/${id}/designs/${designId}/${field}`);
      
      const supabase = createClient();
      await supabase
        .from('designs')
        .update({ [field]: publicUrl })
        .eq('id', designId);

      setDesign({ ...design, [field]: publicUrl });
      logger.info(`Uploaded ${field}`, { designId });
    } catch (error) {
      logger.error(`Failed to upload ${field}`, { error });
      alert("Upload failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDetails = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from('designs')
        .update({ 
          price: price, 
          timeline_weeks: parseInt(timeline) || null 
        })
        .eq('id', designId);
      
      logger.info("Saved design details", { designId });
      alert("Details saved successfully!");
    } catch (error) {
      logger.error("Failed to save details", { error });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="py-24 text-center">Loading Editor...</div>;
  if (!design) return <div className="py-24 text-center text-destructive">Design not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/${lang}/projects/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-180" /> Back to Project
          </Link>
          <h1 className="text-3xl font-light tracking-tight">Presentation Editor</h1>
          <p className="text-muted-foreground mt-1">Customize the client-facing presentation for iteration: {design.version_name}</p>
        </div>
        <Button onClick={saveDetails} disabled={isSaving} className="shadow-lg shadow-primary/20">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="visuals" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="visuals" className="rounded-lg">Visual Assets</TabsTrigger>
          <TabsTrigger value="commercials" className="rounded-lg">Commercials</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-lg">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="visuals" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>Site Photo (Before)</CardTitle>
                <CardDescription>The current state of the building.</CardDescription>
              </CardHeader>
              <CardContent>
                <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'before_image_url')} />
                <div 
                  onClick={() => beforeInputRef.current?.click()}
                  className="aspect-video relative rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 group transition-colors bg-secondary/20"
                >
                  {design.before_image_url ? (
                    <>
                      <img src={design.before_image_url} alt="Before" className="object-cover w-full h-full" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button variant="secondary" size="sm">Change Image</Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click to upload Site Photo</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>Render (After)</CardTitle>
                <CardDescription>High-quality render of the proposed facade.</CardDescription>
              </CardHeader>
              <CardContent>
                <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'after_image_url')} />
                <div 
                  onClick={() => afterInputRef.current?.click()}
                  className="aspect-video relative rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 group transition-colors bg-secondary/20"
                >
                  {design.after_image_url ? (
                    <>
                      <img src={design.after_image_url} alt="After" className="object-cover w-full h-full" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button variant="secondary" size="sm">Change Image</Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click to upload Final Render</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="commercials" className="mt-6">
          <Card className="shadow-sm border-border max-w-2xl">
            <CardHeader>
              <CardTitle>Commercial Details</CardTitle>
              <CardDescription>Pricing and timeline estimates shown to the client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Estimated Price (e.g. SAR 2,450,000)</Label>
                <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="SAR 0.00" className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Estimated Timeline (Weeks)</Label>
                <Input type="number" value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="14" className="bg-secondary/50" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Materials Used</CardTitle>
                <CardDescription>Define the textures and materials used in this specific design.</CardDescription>
              </div>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  No materials defined yet.
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
                      <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
