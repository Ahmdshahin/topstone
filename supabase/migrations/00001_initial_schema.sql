-- ============================================================================
-- FACADE PRESENTATION SYSTEM — INITIAL SCHEMA
-- Migration: 00001_initial_schema
-- Description: Complete database foundation — enums, functions, tables
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- §1  EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "moddatetime" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"     SCHEMA "extensions";  -- trigram fuzzy search


-- ────────────────────────────────────────────────────────────────────────────
-- §2  ENUM TYPES
-- ────────────────────────────────────────────────────────────────────────────
-- Rationale: PostgreSQL enums enforce valid values at the storage layer,
-- prevent typos, enable efficient indexing, and serve as living documentation.

CREATE TYPE public.user_role AS ENUM (
  'admin',
  'manager',
  'designer',
  'viewer'
);
COMMENT ON TYPE public.user_role IS 'System-wide user roles. Admin has full access, viewer is read-only.';

CREATE TYPE public.project_status AS ENUM (
  'draft',
  'active',
  'in_progress',
  'review',
  'completed',
  'archived',
  'cancelled'
);
COMMENT ON TYPE public.project_status IS 'Lifecycle status of a facade project.';

CREATE TYPE public.design_status AS ENUM (
  'draft',
  'in_review',
  'revision_requested',
  'approved',
  'rejected'
);
COMMENT ON TYPE public.design_status IS 'Review workflow status of a design iteration.';

CREATE TYPE public.presentation_status AS ENUM (
  'draft',
  'published',
  'archived'
);
COMMENT ON TYPE public.presentation_status IS 'Visibility state of a client presentation.';

CREATE TYPE public.measurement_unit AS ENUM (
  'mm',
  'cm',
  'm',
  'sqm',
  'sqft',
  'piece',
  'linear_m'
);
COMMENT ON TYPE public.measurement_unit IS 'Units of measurement for facade dimensions and quantities.';

CREATE TYPE public.material_category AS ENUM (
  'natural_stone',
  'engineered_stone',
  'ceramic',
  'porcelain',
  'glass',
  'metal',
  'composite',
  'wood',
  'concrete',
  'other'
);
COMMENT ON TYPE public.material_category IS 'Classification of facade materials by primary composition.';

CREATE TYPE public.notification_type AS ENUM (
  'comment',
  'status_change',
  'assignment',
  'mention',
  'upload',
  'system'
);
COMMENT ON TYPE public.notification_type IS 'Category of notification for filtering and icon selection.';

CREATE TYPE public.activity_action AS ENUM (
  'created',
  'updated',
  'deleted',
  'viewed',
  'shared',
  'published',
  'archived',
  'restored',
  'commented',
  'assigned',
  'uploaded',
  'downloaded',
  'status_changed',
  'logged_in',
  'logged_out'
);
COMMENT ON TYPE public.activity_action IS 'Auditable actions tracked in the activity log.';


-- ────────────────────────────────────────────────────────────────────────────
-- §3  UTILITY FUNCTIONS
-- ────────────────────────────────────────────────────────────────────────────

-- 3a. Generate URL-safe slug from text
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          trim(input_text),
          '[^\w\s-]', '', 'g'       -- Remove special characters
        ),
        '[\s_]+', '-', 'g'          -- Replace spaces/underscores with hyphens
      ),
      '-+', '-', 'g'                -- Collapse multiple hyphens
    )
  );
END;
$$;
COMMENT ON FUNCTION public.generate_slug IS 'Converts arbitrary text into a URL-safe kebab-case slug.';


-- 3b. Auto-set slug before insert (generic trigger function)
CREATE OR REPLACE FUNCTION public.set_slug_from_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  slug_count INTEGER;
BEGIN
  -- Only generate if slug is not explicitly provided
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.title);
    final_slug := base_slug;
    slug_count := 0;

    -- Ensure uniqueness by appending a counter
    LOOP
      PERFORM 1 FROM pg_class
        WHERE relname = TG_TABLE_NAME
        AND relnamespace = TG_TABLE_SCHEMA::regnamespace;

      EXECUTE format(
        'SELECT 1 FROM %I.%I WHERE slug = $1 AND id IS DISTINCT FROM $2',
        TG_TABLE_SCHEMA, TG_TABLE_NAME
      ) USING final_slug, NEW.id INTO slug_count;

      EXIT WHEN slug_count IS NULL;

      slug_count := slug_count + 1;
      final_slug := base_slug || '-' || slug_count;
    END LOOP;

    NEW.slug := final_slug;
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.set_slug_from_title IS 'Trigger function: auto-generates a unique slug from the title column.';


-- 3c. Auto-set slug from name (for materials)
CREATE OR REPLACE FUNCTION public.set_slug_from_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  slug_count INTEGER;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.name);
    final_slug := base_slug;
    slug_count := 0;

    LOOP
      EXECUTE format(
        'SELECT 1 FROM %I.%I WHERE slug = $1 AND id IS DISTINCT FROM $2',
        TG_TABLE_SCHEMA, TG_TABLE_NAME
      ) USING final_slug, NEW.id INTO slug_count;

      EXIT WHEN slug_count IS NULL;

      slug_count := slug_count + 1;
      final_slug := base_slug || '-' || slug_count;
    END LOOP;

    NEW.slug := final_slug;
  END IF;

  RETURN NEW;
END;
$$;


-- 3d. RLS helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
    AND is_active = TRUE
  );
$$;
COMMENT ON FUNCTION public.is_admin IS 'RLS helper: returns true if the authenticated user has admin role.';


-- 3e. RLS helper: check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'manager')
    AND is_active = TRUE
  );
$$;
COMMENT ON FUNCTION public.is_admin_or_manager IS 'RLS helper: returns true if the authenticated user has admin or manager role.';


-- 3f. RLS helper: check if user is a member of a project
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
    AND user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
    AND created_by = (SELECT auth.uid())
  );
$$;
COMMENT ON FUNCTION public.is_project_member IS 'RLS helper: returns true if the user is a member or creator of the given project.';


-- 3g. Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user IS 'Creates a profile row automatically when a new user signs up.';


-- 3h. Generate a cryptographically random share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(gen_random_bytes(24), 'base64')::TEXT;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- §4  CORE TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4a. PROFILES (extends auth.users)                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  role        public.user_role NOT NULL DEFAULT 'viewer',
  job_title   TEXT,
  bio         TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users. One-to-one relationship.';
COMMENT ON COLUMN public.profiles.role IS 'System-wide role: admin (full), manager (team), designer (create), viewer (read-only).';
COMMENT ON COLUMN public.profiles.is_active IS 'Soft-disable: inactive users cannot log in or be assigned to projects.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4b. CLIENTS                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT DEFAULT 'Saudi Arabia',
  website       TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT clients_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

COMMENT ON TABLE public.clients IS 'External clients/customers who commission facade projects.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4c. PROJECTS                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  client_id         UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status            public.project_status NOT NULL DEFAULT 'draft',
  location          TEXT,
  address           TEXT,
  latitude          NUMERIC(10, 7),
  longitude         NUMERIC(10, 7),
  start_date        DATE,
  end_date          DATE,
  estimated_budget  NUMERIC(14, 2),
  actual_cost       NUMERIC(14, 2),
  total_area        NUMERIC(12, 2),
  area_unit         public.measurement_unit DEFAULT 'sqm',
  cover_image_url   TEXT,
  tags              TEXT[] DEFAULT '{}',
  metadata          JSONB DEFAULT '{}',
  created_by        UUID NOT NULL REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT projects_dates_valid CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT projects_budget_positive CHECK (
    estimated_budget IS NULL OR estimated_budget >= 0
  ),
  CONSTRAINT projects_cost_positive CHECK (
    actual_cost IS NULL OR actual_cost >= 0
  ),
  CONSTRAINT projects_latitude_range CHECK (
    latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
  ),
  CONSTRAINT projects_longitude_range CHECK (
    longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
  )
);

COMMENT ON TABLE public.projects IS 'Facade installation projects. Central entity linking clients, materials, designs.';
COMMENT ON COLUMN public.projects.slug IS 'URL-safe unique identifier. Auto-generated from title if not provided.';
COMMENT ON COLUMN public.projects.metadata IS 'Flexible JSONB for project-specific data (floor count, building type, etc.).';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4d. PROJECT MEMBERS (team assignment)                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('lead', 'member', 'reviewer', 'viewer')),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_members_unique UNIQUE (project_id, user_id)
);

COMMENT ON TABLE public.project_members IS 'Many-to-many: assigns users to projects with a per-project role.';
COMMENT ON COLUMN public.project_members.role IS 'Project-scoped role. Lead manages, member creates, reviewer approves, viewer reads.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4e. MATERIALS                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  category        public.material_category NOT NULL,
  sku             TEXT UNIQUE,
  unit_price      NUMERIC(10, 2),
  price_unit      TEXT DEFAULT 'sqm',
  currency        TEXT DEFAULT 'SAR',
  color           TEXT,
  finish          TEXT,
  thickness       TEXT,
  dimensions      TEXT,
  weight_per_unit NUMERIC(8, 2),
  origin_country  TEXT,
  supplier        TEXT,
  specifications  JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT materials_price_positive CHECK (
    unit_price IS NULL OR unit_price >= 0
  ),
  CONSTRAINT materials_weight_positive CHECK (
    weight_per_unit IS NULL OR weight_per_unit >= 0
  )
);

COMMENT ON TABLE public.materials IS 'Catalog of facade materials (stone, glass, metal, etc.) with pricing and specifications.';
COMMENT ON COLUMN public.materials.specifications IS 'Flexible JSONB for material-specific properties (porosity, hardness, fire rating).';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4f. MEASUREMENTS                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.measurements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  width       NUMERIC(10, 2),
  height      NUMERIC(10, 2),
  depth       NUMERIC(10, 2),
  area        NUMERIC(12, 2),
  perimeter   NUMERIC(12, 2),
  unit        public.measurement_unit NOT NULL DEFAULT 'm',
  notes       TEXT,
  measured_by UUID REFERENCES public.profiles(id),
  measured_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT measurements_dimensions_positive CHECK (
    (width IS NULL OR width > 0)
    AND (height IS NULL OR height > 0)
    AND (depth IS NULL OR depth > 0)
    AND (area IS NULL OR area > 0)
  )
);

COMMENT ON TABLE public.measurements IS 'Site measurements for project surfaces (walls, facades, sections).';
COMMENT ON COLUMN public.measurements.label IS 'Human identifier for the measured surface, e.g. "North Wall Section A".';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4g. DESIGNS                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.designs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  description    TEXT,
  version        INTEGER NOT NULL DEFAULT 1,
  status         public.design_status NOT NULL DEFAULT 'draft',
  design_data    JSONB DEFAULT '{}',
  thumbnail_url  TEXT,
  review_notes   TEXT,
  reviewed_by    UUID REFERENCES public.profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT designs_version_positive CHECK (version > 0)
);

COMMENT ON TABLE public.designs IS 'Design iterations for a project. Tracks versions and review workflow.';
COMMENT ON COLUMN public.designs.design_data IS 'Structured design configuration (layout, material placement, patterns).';
COMMENT ON COLUMN public.designs.version IS 'Monotonically increasing version number within a project.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4h. PHOTOS (media library)                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path  TEXT NOT NULL UNIQUE,
  public_url    TEXT,
  mime_type     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  alt_text      TEXT DEFAULT '',
  caption       TEXT,
  tags          TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  uploaded_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT photos_file_size_positive CHECK (file_size > 0),
  CONSTRAINT photos_dimensions_positive CHECK (
    (width IS NULL OR width > 0)
    AND (height IS NULL OR height > 0)
  ),
  CONSTRAINT photos_mime_type_valid CHECK (
    mime_type LIKE 'image/%'
    OR mime_type LIKE 'video/%'
    OR mime_type = 'application/pdf'
  )
);

COMMENT ON TABLE public.photos IS 'Centralized media library. Photos and videos linked to projects, designs, and materials.';
COMMENT ON COLUMN public.photos.storage_path IS 'Path within the Supabase Storage bucket. Source of truth for file location.';
COMMENT ON COLUMN public.photos.metadata IS 'EXIF data, camera info, GPS coordinates, color profile, etc.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4i. PRESENTATIONS                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.presentations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  description           TEXT,
  slides                JSONB NOT NULL DEFAULT '[]',
  status                public.presentation_status NOT NULL DEFAULT 'draft',
  share_token           TEXT UNIQUE DEFAULT public.generate_share_token(),
  share_expires_at      TIMESTAMPTZ,
  is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash         TEXT,
  view_count            INTEGER NOT NULL DEFAULT 0,
  last_viewed_at        TIMESTAMPTZ,
  theme                 JSONB DEFAULT '{}',
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT presentations_view_count_positive CHECK (view_count >= 0),
  CONSTRAINT presentations_password_consistency CHECK (
    (is_password_protected = FALSE)
    OR (is_password_protected = TRUE AND password_hash IS NOT NULL)
  )
);

COMMENT ON TABLE public.presentations IS 'Client-facing slide presentations. Shareable via token-based URLs.';
COMMENT ON COLUMN public.presentations.slides IS 'Ordered array of slide objects: [{type, title, content, media_urls, layout, notes}].';
COMMENT ON COLUMN public.presentations.share_token IS 'Cryptographic token for unauthenticated access to published presentations.';
COMMENT ON COLUMN public.presentations.theme IS 'Visual theme overrides: {primaryColor, fontFamily, logoUrl}.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4j. COMMENTS (polymorphic)                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL CHECK (length(trim(content)) > 0),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'design', 'presentation', 'photo', 'material')),
  entity_id   UUID NOT NULL,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_edited   BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at   TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comments_resolved_consistency CHECK (
    (is_resolved = FALSE)
    OR (is_resolved = TRUE AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT comments_edited_consistency CHECK (
    (is_edited = FALSE)
    OR (is_edited = TRUE AND edited_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.comments IS 'Threaded comments on any entity. Polymorphic via entity_type + entity_id.';
COMMENT ON COLUMN public.comments.parent_id IS 'Self-referencing FK for reply threading. NULL = top-level comment.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4k. NOTIFICATIONS                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT,
  type        public.notification_type NOT NULL DEFAULT 'system',
  entity_type TEXT,
  entity_id   UUID,
  action_url  TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notifications_read_consistency CHECK (
    (is_read = FALSE AND read_at IS NULL)
    OR (is_read = TRUE AND read_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.notifications IS 'Per-user notifications. Supports filtering by type, mark-as-read, and deep linking.';
COMMENT ON COLUMN public.notifications.action_url IS 'Relative URL to navigate to when notification is clicked.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4l. ACTIVITY LOGS (audit trail)                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      public.activity_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No updated_at: activity logs are append-only, never modified.
COMMENT ON TABLE public.activity_logs IS 'Immutable audit trail. Append-only — no UPDATE or DELETE in application layer.';
COMMENT ON COLUMN public.activity_logs.metadata IS 'Contextual data: {before: {...}, after: {...}} for update diffs.';


-- ────────────────────────────────────────────────────────────────────────────
-- §5  JUNCTION TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- 5a. Project ↔ Material (with quantity)
CREATE TABLE public.project_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit        public.measurement_unit DEFAULT 'sqm',
  unit_cost   NUMERIC(10, 2),
  total_cost  NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pm_unique UNIQUE (project_id, material_id),
  CONSTRAINT pm_quantity_positive CHECK (quantity >= 0)
);

COMMENT ON TABLE public.project_materials IS 'Materials allocated to a project with quantities and cost tracking.';
COMMENT ON COLUMN public.project_materials.total_cost IS 'Auto-calculated: quantity × unit_cost. Generated column.';


-- 5b. Project ↔ Photo
CREATE TABLE public.project_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  photo_id    UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  category    TEXT DEFAULT 'general'
              CHECK (category IN ('general', 'before', 'during', 'after', 'reference', 'inspiration')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pp_unique UNIQUE (project_id, photo_id)
);

COMMENT ON TABLE public.project_photos IS 'Links photos to projects with ordering and phase categorization.';


-- 5c. Design ↔ Material
CREATE TABLE public.design_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id     UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  area_coverage NUMERIC(12, 2),
  placement     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dm_unique UNIQUE (design_id, material_id)
);

COMMENT ON TABLE public.design_materials IS 'Materials specified in a design with placement and coverage data.';


-- 5d. Design ↔ Photo
CREATE TABLE public.design_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id   UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  photo_id    UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dp_unique UNIQUE (design_id, photo_id)
);


-- 5e. Material ↔ Photo (product images)
CREATE TABLE public.material_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  photo_id    UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT mp_unique UNIQUE (material_id, photo_id)
);

COMMENT ON TABLE public.material_photos IS 'Product images for materials. One photo can be marked as primary (catalog thumbnail).';
