-- ============================================================================
-- FACADE PRESENTATION SYSTEM — VIEWS
-- Migration: 00004_views
-- Description: Materialized query interfaces for common read patterns
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- §1  PROJECT SUMMARY VIEW
-- ────────────────────────────────────────────────────────────────────────────
-- Denormalizes the most common dashboard query: project list with aggregated
-- counts and related entity names. Avoids N+1 queries in the application.

CREATE OR REPLACE VIEW public.v_project_summary AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.description,
  p.status,
  p.location,
  p.start_date,
  p.end_date,
  p.estimated_budget,
  p.actual_cost,
  p.total_area,
  p.cover_image_url,
  p.tags,
  p.created_at,
  p.updated_at,

  -- Client info
  p.client_id,
  c.company_name   AS client_name,
  c.contact_name   AS client_contact,

  -- Creator info
  p.created_by,
  cr.full_name     AS creator_name,

  -- Aggregated counts (subqueries for RLS compatibility)
  (SELECT COUNT(*) FROM public.project_members pm WHERE pm.project_id = p.id)::INTEGER
    AS member_count,
  (SELECT COUNT(*) FROM public.project_photos pp WHERE pp.project_id = p.id)::INTEGER
    AS photo_count,
  (SELECT COUNT(*) FROM public.designs d WHERE d.project_id = p.id)::INTEGER
    AS design_count,
  (SELECT COUNT(*) FROM public.measurements m WHERE m.project_id = p.id)::INTEGER
    AS measurement_count,
  (SELECT COUNT(*) FROM public.presentations pr WHERE pr.project_id = p.id)::INTEGER
    AS presentation_count,

  -- Calculated fields
  CASE
    WHEN p.end_date IS NOT NULL AND p.end_date < CURRENT_DATE AND p.status NOT IN ('completed', 'archived', 'cancelled')
    THEN TRUE
    ELSE FALSE
  END AS is_overdue,

  CASE
    WHEN p.estimated_budget IS NOT NULL AND p.actual_cost IS NOT NULL
    THEN p.estimated_budget - p.actual_cost
    ELSE NULL
  END AS budget_remaining

FROM public.projects p
LEFT JOIN public.clients c  ON c.id = p.client_id
LEFT JOIN public.profiles cr ON cr.id = p.created_by;

COMMENT ON VIEW public.v_project_summary IS 'Denormalized project view with client name, creator name, and aggregated counts. Use for dashboard lists.';


-- ────────────────────────────────────────────────────────────────────────────
-- §2  ACTIVE PROJECTS VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_active_projects AS
SELECT *
FROM public.v_project_summary
WHERE status NOT IN ('archived', 'cancelled')
ORDER BY updated_at DESC;

COMMENT ON VIEW public.v_active_projects IS 'Active projects only (excludes archived and cancelled). Sorted by most recently updated.';


-- ────────────────────────────────────────────────────────────────────────────
-- §3  MY PROJECTS VIEW
-- ────────────────────────────────────────────────────────────────────────────
-- Projects where the current user is a member or creator.

CREATE OR REPLACE VIEW public.v_my_projects AS
SELECT vps.*
FROM public.v_project_summary vps
WHERE vps.created_by = (SELECT auth.uid())
   OR vps.id IN (
     SELECT pm.project_id
     FROM public.project_members pm
     WHERE pm.user_id = (SELECT auth.uid())
   )
ORDER BY vps.updated_at DESC;

COMMENT ON VIEW public.v_my_projects IS 'Projects assigned to or created by the current user. Uses auth.uid() for row filtering.';


-- ────────────────────────────────────────────────────────────────────────────
-- §4  DESIGN REVIEW QUEUE VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_design_review_queue AS
SELECT
  d.id,
  d.title,
  d.slug,
  d.version,
  d.status,
  d.created_at,
  d.updated_at,

  -- Project context
  d.project_id,
  p.title         AS project_title,
  p.slug          AS project_slug,

  -- Creator
  d.created_by,
  cr.full_name    AS creator_name,

  -- Reviewer
  d.reviewed_by,
  rv.full_name    AS reviewer_name,
  d.reviewed_at,
  d.review_notes,

  -- Time in current status
  EXTRACT(DAY FROM (now() - d.updated_at))::INTEGER AS days_in_status

FROM public.designs d
JOIN public.projects p  ON p.id = d.project_id
LEFT JOIN public.profiles cr ON cr.id = d.created_by
LEFT JOIN public.profiles rv ON rv.id = d.reviewed_by
WHERE d.status = 'in_review'
ORDER BY d.updated_at ASC;  -- Oldest first (FIFO review)

COMMENT ON VIEW public.v_design_review_queue IS 'Designs awaiting review, ordered by wait time (oldest first).';


-- ────────────────────────────────────────────────────────────────────────────
-- §5  RECENT ACTIVITY VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_recent_activity AS
SELECT
  al.id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.description,
  al.metadata,
  al.created_at,

  -- Actor info
  al.user_id,
  pr.full_name  AS user_name,
  pr.avatar_url AS user_avatar

FROM public.activity_logs al
LEFT JOIN public.profiles pr ON pr.id = al.user_id
ORDER BY al.created_at DESC;

COMMENT ON VIEW public.v_recent_activity IS 'Activity feed with user names and avatars. Most recent first.';


-- ────────────────────────────────────────────────────────────────────────────
-- §6  UNREAD NOTIFICATION COUNT VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_unread_notification_count AS
SELECT
  user_id,
  COUNT(*)::INTEGER AS unread_count
FROM public.notifications
WHERE is_read = FALSE
GROUP BY user_id;

COMMENT ON VIEW public.v_unread_notification_count IS 'Per-user unread notification count. Lightweight for polling/badge display.';


-- ────────────────────────────────────────────────────────────────────────────
-- §7  MATERIAL USAGE VIEW
-- ────────────────────────────────────────────────────────────────────────────
-- Shows how materials are used across projects (for inventory/procurement).

CREATE OR REPLACE VIEW public.v_material_usage AS
SELECT
  m.id,
  m.name,
  m.slug,
  m.category,
  m.unit_price,
  m.currency,
  m.is_active,

  -- Usage stats
  COUNT(DISTINCT pm.project_id)::INTEGER AS project_count,
  COALESCE(SUM(pm.quantity), 0)          AS total_quantity,
  COALESCE(SUM(pm.total_cost), 0)        AS total_revenue,

  -- Photo count
  (SELECT COUNT(*) FROM public.material_photos mp WHERE mp.material_id = m.id)::INTEGER
    AS photo_count

FROM public.materials m
LEFT JOIN public.project_materials pm ON pm.material_id = m.id
GROUP BY m.id, m.name, m.slug, m.category, m.unit_price, m.currency, m.is_active
ORDER BY project_count DESC, m.name ASC;

COMMENT ON VIEW public.v_material_usage IS 'Material catalog with aggregated usage across projects. For inventory and procurement planning.';


-- ────────────────────────────────────────────────────────────────────────────
-- §8  CLIENT PORTFOLIO VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_client_portfolio AS
SELECT
  c.id,
  c.company_name,
  c.contact_name,
  c.email,
  c.phone,
  c.city,
  c.country,
  c.is_active,
  c.created_at,

  -- Project stats
  COUNT(p.id)::INTEGER AS total_projects,
  COUNT(p.id) FILTER (WHERE p.status IN ('active', 'in_progress'))::INTEGER AS active_projects,
  COUNT(p.id) FILTER (WHERE p.status = 'completed')::INTEGER AS completed_projects,
  COALESCE(SUM(p.actual_cost), 0) AS total_spend,
  MAX(p.created_at) AS last_project_date

FROM public.clients c
LEFT JOIN public.projects p ON p.client_id = c.id
GROUP BY c.id, c.company_name, c.contact_name, c.email, c.phone, c.city, c.country, c.is_active, c.created_at
ORDER BY last_project_date DESC NULLS LAST;

COMMENT ON VIEW public.v_client_portfolio IS 'Client list with aggregated project stats and total spend. For CRM and reporting.';


-- ────────────────────────────────────────────────────────────────────────────
-- §9  COMMENT THREAD VIEW
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_comment_threads AS
SELECT
  c.id,
  c.content,
  c.entity_type,
  c.entity_id,
  c.parent_id,
  c.is_edited,
  c.is_resolved,
  c.created_at,
  c.updated_at,

  -- Author info
  c.author_id,
  pr.full_name  AS author_name,
  pr.avatar_url AS author_avatar,
  pr.role       AS author_role,

  -- Reply count (for top-level comments)
  (SELECT COUNT(*) FROM public.comments r WHERE r.parent_id = c.id)::INTEGER AS reply_count,

  -- Resolver info
  c.resolved_by,
  rv.full_name  AS resolver_name,
  c.resolved_at

FROM public.comments c
LEFT JOIN public.profiles pr ON pr.id = c.author_id
LEFT JOIN public.profiles rv ON rv.id = c.resolved_by
ORDER BY c.created_at ASC;

COMMENT ON VIEW public.v_comment_threads IS 'Comments with author details and reply counts. Filter by entity_type + entity_id for a specific thread.';
