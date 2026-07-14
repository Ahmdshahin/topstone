import { PresentationView, PresentationData } from "@/components/presentation/presentation-view";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/dictionaries";

export default async function PhotoPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string, lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, lang } = await params;
  const searchValues = await searchParams;
  const fromGallery = searchValues?.from === 'gallery';
  const dict = await getDictionary(lang as "ar" | "en");

  const supabase = await createClient();
  
  // 1. Fetch photo data
  const { data: photo } = await supabase
    .from('photos')
    .select('*')
    .eq('id', id)
    .single();

  if (!photo) {
    notFound();
  }

  const additionalUrls = photo.metadata?.additional_urls || [];
  
  // Create an array of all images for the slider
  const allImages = [photo.public_url, ...additionalUrls];

  // 3. Construct Live Data
  const livePresentationData: PresentationData = {
    title: photo.caption || photo.file_name,
    clientName: dict.gallery?.tabs?.photos || "Gallery Photo",
    description: photo.caption ? `${dict.gallery?.photoAlbumTitle || "Gallery album featuring:"} ${photo.caption}` : dict.manageGallery?.photos || "Gallery Album",
    heroImage: photo.public_url,
    beforeImage: "",
    afterImage: "",
    beforeImages: [],
    afterImages: allImages, // Use afterImages array to populate the slider at the bottom
    model3dUrl: "",
    price: "N/A",
    timeline: dict.project?.status?.completed || "Completed",
    views: Math.floor(Math.random() * 50) + 1,
    materials: []
  };

  // 4. Check if current viewer is the architect/owner
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === photo.uploaded_by;

  return (
    <PresentationView 
      data={livePresentationData} 
      isOwner={isOwner}
      projectId={photo.id}
      lang={lang}
      fromGallery={fromGallery}
    />
  );
}
