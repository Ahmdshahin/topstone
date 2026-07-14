-- ============================================================================
-- FACADE PRESENTATION SYSTEM — INDEXES
-- Migration: 00002_indexes
-- Description: Performance indexes on all foreign keys and query patterns
-- ============================================================================
-- Rationale: PostgreSQL does NOT auto-create indexes on FK columns.
-- Every FK and every column used in WHERE/ORDER BY/JOIN gets an index.
-- Naming convention: idx_{table}_{column(s)}
-- ────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE INDEX idx_profiles_email      ON public.profiles (email);
CREATE INDEX idx_profiles_role       ON public.profiles (role);
CREATE INDEX idx_profiles_is_active  ON public.profiles (is_active) WHERE is_active = TRUE;

-- ── clients ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_clients_company_name   ON public.clients USING gin (company_name extensions.gin_trgm_ops);
CREATE INDEX idx_clients_created_by     ON public.clients (created_by);
CREATE INDEX idx_clients_is_active      ON public.clients (is_active) WHERE is_active = TRUE;

-- ── projects ────────────────────────────────────────────────────────────────
CREATE INDEX idx_projects_client_id     ON public.projects (client_id);
CREATE INDEX idx_projects_status        ON public.projects (status);
CREATE INDEX idx_projects_created_by    ON public.projects (created_by);
CREATE INDEX idx_projects_created_at    ON public.projects (created_at DESC);
CREATE INDEX idx_projects_tags          ON public.projects USING gin (tags);
CREATE INDEX idx_projects_title_search  ON public.projects USING gin (title extensions.gin_trgm_ops);

-- ── project_members ─────────────────────────────────────────────────────────
CREATE INDEX idx_project_members_user_id    ON public.project_members (user_id);
CREATE INDEX idx_project_members_project_id ON public.project_members (project_id);

-- ── materials ───────────────────────────────────────────────────────────────
CREATE INDEX idx_materials_category     ON public.materials (category);
CREATE INDEX idx_materials_is_active    ON public.materials (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_materials_created_by   ON public.materials (created_by);
CREATE INDEX idx_materials_name_search  ON public.materials USING gin (name extensions.gin_trgm_ops);

-- ── measurements ────────────────────────────────────────────────────────────
CREATE INDEX idx_measurements_project_id  ON public.measurements (project_id);
CREATE INDEX idx_measurements_measured_by ON public.measurements (measured_by);

-- ── designs ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_designs_project_id   ON public.designs (project_id);
CREATE INDEX idx_designs_status       ON public.designs (status);
CREATE INDEX idx_designs_created_by   ON public.designs (created_by);
CREATE INDEX idx_designs_reviewed_by  ON public.designs (reviewed_by);

-- ── photos ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_photos_uploaded_by   ON public.photos (uploaded_by);
CREATE INDEX idx_photos_mime_type     ON public.photos (mime_type);
CREATE INDEX idx_photos_tags          ON public.photos USING gin (tags);
CREATE INDEX idx_photos_created_at    ON public.photos (created_at DESC);

-- ── presentations ───────────────────────────────────────────────────────────
CREATE INDEX idx_presentations_project_id  ON public.presentations (project_id);
CREATE INDEX idx_presentations_status      ON public.presentations (status);
CREATE INDEX idx_presentations_created_by  ON public.presentations (created_by);
-- share_token already has UNIQUE constraint → implicit unique index

-- ── comments ────────────────────────────────────────────────────────────────
CREATE INDEX idx_comments_entity        ON public.comments (entity_type, entity_id);
CREATE INDEX idx_comments_author_id     ON public.comments (author_id);
CREATE INDEX idx_comments_parent_id     ON public.comments (parent_id);
CREATE INDEX idx_comments_created_at    ON public.comments (created_at DESC);

-- ── notifications ───────────────────────────────────────────────────────────
CREATE INDEX idx_notifications_user_unread  ON public.notifications (user_id, is_read)
  WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_id      ON public.notifications (user_id);
CREATE INDEX idx_notifications_created_at   ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_entity       ON public.notifications (entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- ── activity_logs ───────────────────────────────────────────────────────────
CREATE INDEX idx_activity_logs_user_id      ON public.activity_logs (user_id);
CREATE INDEX idx_activity_logs_entity       ON public.activity_logs (entity_type, entity_id);
CREATE INDEX idx_activity_logs_action       ON public.activity_logs (action);
CREATE INDEX idx_activity_logs_created_at   ON public.activity_logs (created_at DESC);

-- ── junction tables ─────────────────────────────────────────────────────────
-- (FK columns in junction tables — the UNIQUE constraints already create
--  composite indexes, but we need single-column indexes for reverse lookups)

CREATE INDEX idx_project_materials_material_id  ON public.project_materials (material_id);
CREATE INDEX idx_project_photos_photo_id        ON public.project_photos (photo_id);
CREATE INDEX idx_design_materials_material_id   ON public.design_materials (material_id);
CREATE INDEX idx_design_photos_photo_id         ON public.design_photos (photo_id);
CREATE INDEX idx_material_photos_photo_id       ON public.material_photos (photo_id);
