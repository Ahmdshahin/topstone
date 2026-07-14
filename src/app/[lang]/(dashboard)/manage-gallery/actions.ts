"use server";

import { createClient } from "@supabase/supabase-js";

export async function uploadGalleryPhoto(formData: FormData) {
  try {
    const files = formData.getAll("files") as File[];
    const caption = formData.get("caption") as string;
    const uploadedBy = formData.get("uploadedBy") as string;

    if (!files || files.length === 0 || !uploadedBy) {
      throw new Error("Missing required fields");
    }

    // Use Service Role Key to bypass RLS for the gallery bucket
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const uploadedUrls: string[] = [];
    let mainFilePath = "";

    // 1. Upload all files to storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      if (i === 0) mainFilePath = filePath;

      // Convert Next.js File object to ArrayBuffer for Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('gallery')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error("Failed to upload image to storage.");
      }

      // Get Public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('gallery')
        .getPublicUrl(filePath);
        
      uploadedUrls.push(urlData.publicUrl);
    }

    const mainFile = files[0];
    if (!mainFile) throw new Error("No main file found");
    const mainUrl = uploadedUrls[0];
    const additionalUrls = uploadedUrls.slice(1);

    // 3. Insert into photos table
    const { error: dbError } = await supabaseAdmin
      .from('photos')
      .insert({
        file_name: mainFile.name,
        original_name: mainFile.name,
        storage_path: mainFilePath,
        public_url: mainUrl,
        mime_type: mainFile.type,
        file_size: mainFile.size,
        caption: caption,
        uploaded_by: uploadedBy,
        metadata: { additional_urls: additionalUrls }
      });

    if (dbError) {
      console.error("Database insert error:", dbError);
      throw new Error("Failed to save photo record to database.");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Action error:", error);
    return { success: false, error: error.message || "An unexpected error occurred." };
  }
}

export async function getGalleryPhotos() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Failed to fetch gallery photos:", error);
    return [];
  }

  return data;
}

export async function deleteGalleryPhoto(id: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the photo record to find its URLs
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !photo) {
      throw new Error("Photo not found");
    }

    // Extract storage paths from URLs
    const urls = [photo.public_url, ...(photo.metadata?.additional_urls || [])];
    const pathsToDelete = urls.map(url => {
      // url format is something like https://.../storage/v1/object/public/gallery/photos/abc.jpg
      const parts = url.split('/gallery/');
      return parts.length > 1 ? parts[1] : null;
    }).filter(Boolean) as string[];

    // Delete from storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('gallery')
        .remove(pathsToDelete);
        
      if (storageError) {
        console.error("Storage delete error:", storageError);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('photos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Delete action error:", error);
    return { success: false, error: error.message || "Failed to delete album" };
  }
}

export async function updateGalleryPhoto(id: string, caption: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
      .from('photos')
      .update({ caption })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Update action error:", error);
    return { success: false, error: error.message || "Failed to update album" };
  }
}
