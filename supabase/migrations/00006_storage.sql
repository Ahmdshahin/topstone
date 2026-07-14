-- ============================================================================
-- FACADE PRESENTATION SYSTEM — STORAGE BUCKETS & POLICIES
-- Migration: 00006_storage
-- Description: Supabase Storage buckets with fine-grained access policies
-- ============================================================================
--
-- BUCKET ARCHITECTURE:
--
--   project-files/     → Project photos, documents, site images
--   design-files/      → Design renders, CAD exports, thumbnails
--   material-images/   → Product catalog images
--   presentation-assets/ → Slides, media for presentations
--   avatars/           → User profile pictures
--
-- STORAGE PATH CONVENTION:
--   {bucket}/{user_id}/{entity_id}/{filename}
--   This structure enables per-user and per-entity RLS policies.
--
-- ────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  BUCKET CREATION                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'project-files',
    'project-files',
    FALSE,                          -- Private: requires auth
    52428800,                        -- 50MB per file
    ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
      'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'design-files',
    'design-files',
    FALSE,
    104857600,                       -- 100MB (CAD files can be large)
    ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml',
      'image/tiff',
      'application/pdf',
      'application/octet-stream',    -- For .dwg, .skp, .3dm files
      'model/gltf+json', 'model/gltf-binary'
    ]
  ),
  (
    'material-images',
    'material-images',
    TRUE,                            -- Public: catalog images are public
    10485760,                        -- 10MB per image
    ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif'
    ]
  ),
  (
    'presentation-assets',
    'presentation-assets',
    FALSE,
    52428800,                        -- 50MB
    ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml',
      'video/mp4', 'video/webm',
      'application/pdf'
    ]
  ),
  (
    'avatars',
    'avatars',
    TRUE,                            -- Public: avatars displayed everywhere
    5242880,                         -- 5MB
    ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif'
    ]
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORAGE POLICIES: project-files                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Authenticated users can view project files
CREATE POLICY "project_files_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-files');

-- Authenticated users can upload to project-files (under their user folder)
CREATE POLICY "project_files_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

-- Users can update their own uploads; admins can update any
CREATE POLICY "project_files_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );

-- Users can delete their own uploads; admins can delete any
CREATE POLICY "project_files_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORAGE POLICIES: design-files                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE POLICY "design_files_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'design-files');

CREATE POLICY "design_files_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'design-files'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE POLICY "design_files_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'design-files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );

CREATE POLICY "design_files_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'design-files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORAGE POLICIES: material-images (public bucket)                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Anyone can view material images (public catalog)
CREATE POLICY "material_images_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'material-images');

-- Authenticated users can upload material images
CREATE POLICY "material_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'material-images');

-- Admins and managers can update/delete material images
CREATE POLICY "material_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'material-images'
    AND public.is_admin_or_manager()
  );

CREATE POLICY "material_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'material-images'
    AND public.is_admin_or_manager()
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORAGE POLICIES: presentation-assets                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Authenticated users can view presentation assets
CREATE POLICY "presentation_assets_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'presentation-assets');

-- Anonymous users can view presentation assets (for shared presentations)
CREATE POLICY "presentation_assets_select_public"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'presentation-assets');

CREATE POLICY "presentation_assets_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'presentation-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE POLICY "presentation_assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'presentation-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );

CREATE POLICY "presentation_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'presentation-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_admin_or_manager()
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORAGE POLICIES: avatars (public bucket)                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Anyone can view avatars
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar (folder must match their user ID)
CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

-- Users can update their own avatar
CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );
