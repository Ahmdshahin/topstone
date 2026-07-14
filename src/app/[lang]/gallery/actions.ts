
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export const getPublicGalleryData = unstable_cache(async () => {
  
  // Use the service role key to bypass RLS for public gallery read
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch completed projects that have show_in_gallery = true
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      description,
      hero_image_url,
      location_url,
      share_token,
      clients ( name )
    `)
    .eq('status', 'completed')
    .contains('metadata', { show_in_gallery: true })
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error("Error fetching gallery projects:", projectsError);
  }

  // Fetch photos
  const { data: photosData, error: photosError } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });

  if (photosError) {
    console.error("Error fetching gallery photos:", photosError);
  }

  return {
    projects: projectsData || [],
    photos: photosData || []
  };
}, ['public-gallery-data'], { revalidate: 3600, tags: ['gallery'] });
