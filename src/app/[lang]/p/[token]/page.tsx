import { PresentationView, PresentationData } from "@/components/presentation/presentation-view";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { differenceInWeeks, differenceInDays } from "date-fns";
import { getDictionary } from "@/lib/dictionaries";

export default async function PresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string, lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token, lang } = await params;
  const searchValues = await searchParams;
  const fromGallery = searchValues?.from === 'gallery';
  const dict = await getDictionary(lang as "ar" | "en");

  const supabase = await createClient();
  
  // 1. Fetch live project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('share_token', token)
    .single();

  if (!project) {
    notFound();
  }

  // Check expiration
  if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-2 text-foreground">{dict.presentation?.expiredTitle || "Link Expired"}</h1>
          <p className="text-muted-foreground">{dict.presentation?.expiredDesc || "This presentation link is no longer active."}</p>
        </div>
      </div>
    );
  }

  // 2. Fetch designs/materials (if they exist)
  const { data: designs } = await supabase
    .from('designs')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const design = designs?.[0];

  const { data: pmData } = await supabase
    .from('project_materials')
    .select('materials(*)')
    .eq('project_id', project.id);
    
  const materials = pmData ? pmData.map((pm: any) => pm.materials).filter(Boolean) : [];

  // Calculate Timeline dynamically
  const createdAt = new Date(project.created_at);
  const approvedAt = project.status === 'completed' ? new Date(project.updated_at || project.created_at) : new Date();
  const diffWeeks = differenceInWeeks(approvedAt, createdAt);
  const diffDays = differenceInDays(approvedAt, createdAt);
  
  let calculatedTimeline = dict.presentation?.justStarted || "Just started";
  if (diffWeeks > 0) {
    calculatedTimeline = lang === 'ar' 
      ? `${diffWeeks} ${diffWeeks === 1 ? 'أسبوع' : diffWeeks === 2 ? 'أسبوعين' : diffWeeks <= 10 ? 'أسابيع' : 'أسبوع'}` 
      : `${diffWeeks} Week${diffWeeks > 1 ? 's' : ''}`;
  } else if (diffDays > 0) {
    calculatedTimeline = lang === 'ar'
      ? `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : diffDays <= 10 ? 'أيام' : 'يوم'}`
      : `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  }

  // 3. Construct Live Data
  const livePresentationData: PresentationData = {
    title: project.title,
    clientName: project.client_name || "Unknown Client",
    description: project.description || dict.presentation?.welcome || "Welcome to the presentation.",
    heroImage: project.hero_image_url || design?.after_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2940&auto=format&fit=crop", // Fallback only if totally empty
    beforeImage: design?.before_image_url || "",
    afterImage: design?.after_image_url || "",
    beforeImages: design?.before_images || [],
    afterImages: design?.after_images || [],
    model3dUrl: design?.model_3d_url || "",
    price: design?.price || dict.presentation?.tbd || "TBD",
    timeline: calculatedTimeline,
    views: Math.floor(Math.random() * 50) + 1, // Keep mock live views for demo purposes
    materials: materials.map((m: any) => ({
      id: m.id,
      name: m.name,
      image_url: m.image_url,
      description: m.description,
      size: m.size,
      color: m.color,
      category: m.category
    }))
  };

  // 4. Check if current viewer is the architect/owner
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === project.created_by;

  return (
    <PresentationView 
      data={livePresentationData} 
      isOwner={isOwner}
      projectId={project.id}
      designId={design?.id}
      lang={lang}
      fromGallery={fromGallery}
    />
  );
}
