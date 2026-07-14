import { createClient } from "./client";
import { v4 as uuidv4 } from "uuid";

export const STORAGE_BUCKET = "facade-assets";

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * 
 * @param file The File object from an input element
 * @param folder The folder path (e.g., 'projects/123/models')
 * @returns The public URL of the uploaded file
 */
export async function uploadAsset(file: File, folder: string): Promise<string> {
  const supabase = createClient();
  
  // Generate a unique filename to prevent collisions
  const fileExt = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  return publicUrl;
}
