"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, ExternalLink, Image as ImageIcon, AlertCircle, Trash2, Edit, Save, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";
import Link from "next/link";

import { uploadGalleryPhoto, getGalleryPhotos, deleteGalleryPhoto, updateGalleryPhoto } from "./actions";

export default function ManageGalleryPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  
  const { profile, user } = useAuth();
  const { lang, dict } = useTranslation();

  const [albums, setAlbums] = useState<any[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    setLoadingAlbums(true);
    const data = await getGalleryPhotos();
    setAlbums(data);
    setLoadingAlbums(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(dict.manageGallery?.deleteConfirm || "Are you sure you want to delete this album? This action cannot be undone.")) return;
    setIsDeleting(id);
    const res = await deleteGalleryPhoto(id);
    setIsDeleting(null);
    if (res.success) {
      fetchAlbums();
    } else {
      alert(res.error || "Failed to delete album");
    }
  };

  const handleEdit = (album: any) => {
    setEditingAlbumId(album.id);
    setEditCaption(album.caption || "");
  };

  const handleUpdate = async (id: string) => {
    const res = await updateGalleryPhoto(id, editCaption);
    if (res.success) {
      setEditingAlbumId(null);
      fetchAlbums();
    } else {
      alert(res.error || "Failed to update album");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const uploaderId = profile?.id || user?.id;
    if (files.length === 0 || !uploaderId) {
      setUploadStatus({ success: false, message: "Authentication error or missing files. Please refresh and try again." });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("caption", caption);
      formData.append("uploadedBy", uploaderId);

      const result = await uploadGalleryPhoto(formData);

      if (!result.success) {
        throw new Error(result.error);
      }

      setUploadStatus({ success: true, message: "Photos uploaded successfully to the gallery!" });
      setFiles([]);
      setCaption("");
      
      // Reset file input
      const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchAlbums();
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus({ success: false, message: error.message || "Failed to upload photo." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-light tracking-tight">{dict.manageGallery?.title || "Manage Gallery"}</h2>
          <p className="text-muted-foreground mt-1">{dict.manageGallery?.description || "Upload standalone photos to your public gallery."}</p>
        </div>
        
        <Button asChild variant="outline" className="shrink-0 gap-2">
          <Link href={`/${lang}/gallery`} target="_blank">
            <ExternalLink className="w-4 h-4" />
            View Public Gallery
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.manageGallery?.uploadTitle || "Upload Photo"}</CardTitle>
          <CardDescription>
            {dict.manageGallery?.uploadDesc || "Photos uploaded here will appear in the \"Photo Gallery\" tab of the public gallery page."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="photo-upload">{dict.manageGallery?.selectImages || "Select Images (Select multiple for an album)"}</Label>
              <Input 
                id="photo-upload" 
                type="file" 
                accept="image/jpeg, image/png, image/webp, image/avif" 
                multiple
                onChange={handleFileChange} 
                disabled={isUploading} 
                required
              />
              {files.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {files.length} {dict.manageGallery?.filesSelected || "file(s) selected"}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="caption">{dict.manageGallery?.captionOptional || "Caption / Reference (Optional)"}</Label>
              <Input 
                id="caption" 
                placeholder={dict.manageGallery?.captionPlaceholder || "e.g. Modern Villa Facade - Riyadh"} 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            {uploadStatus && (
              <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${uploadStatus.success ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                {uploadStatus.success ? <ImageIcon className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {uploadStatus.message}
              </div>
            )}

            <Button type="submit" disabled={files.length === 0 || isUploading} className="w-full sm:w-auto">
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {dict.manageGallery?.uploading || "Uploading"} {files.length} {dict.manageGallery?.photos || "photo(s)"}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {dict.manageGallery?.uploadAlbum || "Upload Album"}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.manageGallery?.existingAlbums || "Existing Albums"}</CardTitle>
          <CardDescription>{dict.manageGallery?.existingAlbumsDesc || "Manage your previously uploaded photo albums."}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAlbums ? (
            <div className="flex justify-center items-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : albums.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{dict.manageGallery?.noAlbums || "No albums found."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map((album) => {
                const totalPhotos = 1 + (album.metadata?.additional_urls?.length || 0);
                const isEditing = editingAlbumId === album.id;
                
                return (
                  <div key={album.id} className="border rounded-lg overflow-hidden flex flex-col group relative">
                    <div className="aspect-[4/3] bg-secondary relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={album.public_url} 
                        alt={album.caption || dict.manageGallery?.photo || "Gallery Photo"} 
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {totalPhotos} {totalPhotos !== 1 ? (dict.manageGallery?.photos || "Photos") : (dict.manageGallery?.photo || "Photo")}
                      </div>
                    </div>
                    
                    <div className="p-4 flex flex-col flex-1 bg-card">
                      {isEditing ? (
                        <div className="space-y-3 flex-1">
                          <Input 
                            value={editCaption} 
                            onChange={(e) => setEditCaption(e.target.value)} 
                            placeholder={dict.manageGallery?.albumCaption || "Album caption"}
                            className="h-8"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditingAlbumId(null)}>
                              <X className="w-4 h-4 mr-1" /> {dict.manageGallery?.cancel || "Cancel"}
                            </Button>
                            <Button size="sm" onClick={() => handleUpdate(album.id)}>
                              <Save className="w-4 h-4 mr-1" /> {dict.manageGallery?.save || "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 mb-4">
                            <p className="font-medium line-clamp-2 text-sm">{album.caption || dict.manageGallery?.noCaption || "No Caption"}</p>
                          </div>
                          <div className="flex justify-between items-center mt-auto border-t pt-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground hover:text-foreground h-8 px-2"
                              onClick={() => handleEdit(album)}
                            >
                              <Edit className="w-4 h-4 mr-2" /> {dict.manageGallery?.edit || "Edit"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 px-2"
                              onClick={() => handleDelete(album.id)}
                              disabled={isDeleting === album.id}
                            >
                              {isDeleting === album.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                              )}
                              {dict.manageGallery?.delete || "Delete"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
