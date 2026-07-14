import { getPublicGalleryData } from "./actions";
import { GalleryClient } from "./gallery-client";

// Cache this page on the edge network for 1 hour
export const revalidate = 3600; 

export default async function GalleryPage() {
  const { projects, photos } = await getPublicGalleryData();

  return <GalleryClient projects={projects} photos={photos} />;
}
