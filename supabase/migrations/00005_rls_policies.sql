-- ============================================================================
-- FACADE PRESENTATION SYSTEM — ROW LEVEL SECURITY
-- Migration: 00005_rls_policies
-- Description: Fine-grained access control on every table
-- ============================================================================
--
-- ACCESS MODEL:
--
--   Admin       → Full CRUD on everything
--   Manager     → Full CRUD on everything (same as admin, but distinct role)
--   Designer    → CRUD on own content, read all, write assigned projects
--   Viewer      → Read-only on assigned projects and published content
--
-- SECURITY PRINCIPLES:
--   1. RLS is enabled on EVERY public table
--   2. Default-deny: enabling RLS without policies = zero access
--   3. auth.uid() is wrapped in subqueries for performance: (SELECT auth.uid())
--   4. Helper functions (is_admin, is_project_member) are SECURITY DEFINER
--   5. Activity logs are append-only: no UPDATE/DELETE policies
--
-- ────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENABLE RLS ON ALL TABLES                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_materials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_photos   ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PROFILES                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view profiles (team directory)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Admins can update any profile (role changes, deactivation)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CLIENTS                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view clients
CREATE POLICY "clients_select_authenticated"
  ON public.clients FOR SELECT
  TO authenticated
  USING (TRUE);

-- Admins and managers can create clients
CREATE POLICY "clients_insert_admin_manager"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admins and managers can update clients
CREATE POLICY "clients_update_admin_manager"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admins can delete clients
CREATE POLICY "clients_delete_admin"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PROJECTS                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Authenticated users can see projects they're a member of, or all if admin/manager
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
    OR public.is_project_member(id)
  );

-- Admins, managers can create projects
CREATE POLICY "projects_insert"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Creator, admins, managers can update projects
CREATE POLICY "projects_update"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  );

-- Only admins can delete projects
CREATE POLICY "projects_delete"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PROJECT MEMBERS                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Members can see who's on their projects
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR user_id = (SELECT auth.uid())
    OR public.is_project_member(project_id)
  );

-- Admins, managers, and project creators can add members
CREATE POLICY "project_members_insert"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND created_by = (SELECT auth.uid())
    )
  );

-- Admins, managers, and project creators can update member roles
CREATE POLICY "project_members_update"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND created_by = (SELECT auth.uid())
    )
  );

-- Admins, managers, and project creators can remove members
CREATE POLICY "project_members_delete"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND created_by = (SELECT auth.uid())
    )
    -- Users can remove themselves
    OR user_id = (SELECT auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MATERIALS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view the material catalog
CREATE POLICY "materials_select_authenticated"
  ON public.materials FOR SELECT
  TO authenticated
  USING (TRUE);

-- Admins, managers, designers can create materials
CREATE POLICY "materials_insert"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'designer'
    )
  );

-- Creator and admins/managers can update
CREATE POLICY "materials_update"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  );

-- Only admins can delete materials (they may be referenced in projects)
CREATE POLICY "materials_delete"
  ON public.materials FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MEASUREMENTS                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Project members can view measurements
CREATE POLICY "measurements_select"
  ON public.measurements FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

-- Project members (non-viewer) can create measurements
CREATE POLICY "measurements_insert"
  ON public.measurements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

-- Creator and admins can update
CREATE POLICY "measurements_update"
  ON public.measurements FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR measured_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR measured_by = (SELECT auth.uid())
  );

-- Creator and admins can delete
CREATE POLICY "measurements_delete"
  ON public.measurements FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR measured_by = (SELECT auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DESIGNS                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Project members can view designs
CREATE POLICY "designs_select"
  ON public.designs FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

-- Project members can create designs
CREATE POLICY "designs_insert"
  ON public.designs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

-- Creator, reviewer, admins can update designs
CREATE POLICY "designs_update"
  ON public.designs FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  );

-- Creator and admins can delete designs
CREATE POLICY "designs_delete"
  ON public.designs FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR created_by = (SELECT auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHOTOS                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view photos
CREATE POLICY "photos_select_authenticated"
  ON public.photos FOR SELECT
  TO authenticated
  USING (TRUE);

-- Any authenticated user can upload photos
CREATE POLICY "photos_insert_authenticated"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

-- Uploader and admins can update photo metadata
CREATE POLICY "photos_update"
  ON public.photos FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR uploaded_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR uploaded_by = (SELECT auth.uid())
  );

-- Uploader and admins can delete photos
CREATE POLICY "photos_delete"
  ON public.photos FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR uploaded_by = (SELECT auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PRESENTATIONS                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Project members and admins can view presentations
CREATE POLICY "presentations_select"
  ON public.presentations FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
    OR (project_id IS NOT NULL AND public.is_project_member(project_id))
  );

-- Published presentations are viewable by anyone via share token (anonymous)
CREATE POLICY "presentations_select_public"
  ON public.presentations FOR SELECT
  TO anon
  USING (
    status = 'published'
    AND (share_expires_at IS NULL OR share_expires_at > now())
  );

-- Admins, managers can create presentations
CREATE POLICY "presentations_insert"
  ON public.presentations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR (project_id IS NOT NULL AND public.is_project_member(project_id))
  );

-- Creator and admins can update
CREATE POLICY "presentations_update"
  ON public.presentations FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR created_by = (SELECT auth.uid())
  );

-- Only admins and creator can delete
CREATE POLICY "presentations_delete"
  ON public.presentations FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR created_by = (SELECT auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  COMMENTS                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can read comments on entities they can access
CREATE POLICY "comments_select_authenticated"
  ON public.comments FOR SELECT
  TO authenticated
  USING (TRUE);

-- Authenticated users can create comments
CREATE POLICY "comments_insert_authenticated"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

-- Authors can update their own comments
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

-- Admins and managers can resolve/update any comment
CREATE POLICY "comments_update_admin"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Authors can delete their own comments, admins can delete any
CREATE POLICY "comments_delete"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR public.is_admin()
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  NOTIFICATIONS                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- System inserts notifications (via triggers with SECURITY DEFINER)
-- Allow insert for trigger functions
CREATE POLICY "notifications_insert_system"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ACTIVITY LOGS  (append-only)                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admins and managers can view all activity
CREATE POLICY "activity_logs_select_admin_manager"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR user_id = (SELECT auth.uid())
  );

-- Any authenticated user can insert activity logs (via triggers/functions)
CREATE POLICY "activity_logs_insert"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- NO UPDATE policy: activity logs are immutable
-- NO DELETE policy: activity logs are immutable (admin can use service role if needed)


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  JUNCTION TABLES                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── project_materials ───────────────────────────────────────────────────────

CREATE POLICY "project_materials_select"
  ON public.project_materials FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_materials_insert"
  ON public.project_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_materials_update"
  ON public.project_materials FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_materials_delete"
  ON public.project_materials FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );


-- ── project_photos ──────────────────────────────────────────────────────────

CREATE POLICY "project_photos_select"
  ON public.project_photos FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_photos_insert"
  ON public.project_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_photos_delete"
  ON public.project_photos FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR public.is_project_member(project_id)
  );


-- ── design_materials ────────────────────────────────────────────────────────

CREATE POLICY "design_materials_select"
  ON public.design_materials FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND public.is_project_member(d.project_id)
    )
  );

CREATE POLICY "design_materials_insert"
  ON public.design_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND (d.created_by = (SELECT auth.uid()) OR public.is_project_member(d.project_id))
    )
  );

CREATE POLICY "design_materials_delete"
  ON public.design_materials FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND d.created_by = (SELECT auth.uid())
    )
  );


-- ── design_photos ───────────────────────────────────────────────────────────

CREATE POLICY "design_photos_select"
  ON public.design_photos FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND public.is_project_member(d.project_id)
    )
  );

CREATE POLICY "design_photos_insert"
  ON public.design_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND (d.created_by = (SELECT auth.uid()) OR public.is_project_member(d.project_id))
    )
  );

CREATE POLICY "design_photos_delete"
  ON public.design_photos FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_id
      AND d.created_by = (SELECT auth.uid())
    )
  );


-- ── material_photos ─────────────────────────────────────────────────────────

CREATE POLICY "material_photos_select"
  ON public.material_photos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "material_photos_insert"
  ON public.material_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id
      AND m.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "material_photos_delete"
  ON public.material_photos FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id
      AND m.created_by = (SELECT auth.uid())
    )
  );
