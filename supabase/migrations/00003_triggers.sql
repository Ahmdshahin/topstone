-- ============================================================================
-- FACADE PRESENTATION SYSTEM — TRIGGERS
-- Migration: 00003_triggers
-- Description: Automated behaviors — timestamps, slugs, auditing, notifications
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- §1  AUTOMATIC TIMESTAMP TRIGGERS  (updated_at)
-- ────────────────────────────────────────────────────────────────────────────
-- Uses the moddatetime extension for efficient updated_at management.
-- Every table with an updated_at column gets this trigger.

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_measurements_updated_at
  BEFORE UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_designs_updated_at
  BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_presentations_updated_at
  BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────────────────────
-- §2  SLUG GENERATION TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_projects_slug
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_slug_from_title();

CREATE TRIGGER set_designs_slug
  BEFORE INSERT ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.set_slug_from_title();

CREATE TRIGGER set_presentations_slug
  BEFORE INSERT ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.set_slug_from_title();

CREATE TRIGGER set_materials_slug
  BEFORE INSERT ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_slug_from_name();


-- ────────────────────────────────────────────────────────────────────────────
-- §3  AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────────────────────
-- §4  PROJECT STATUS CHANGE NOTIFICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify all project members
    INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id, action_url)
    SELECT
      pm.user_id,
      'Project Status Updated',
      format('"%s" moved from %s to %s', NEW.title, OLD.status, NEW.status),
      'status_change',
      'project',
      NEW.id,
      format('/dashboard/projects/%s', NEW.id)
    FROM public.project_members pm
    WHERE pm.project_id = NEW.id
      AND pm.user_id IS DISTINCT FROM (SELECT auth.uid()); -- Don't notify the actor

    -- Log activity
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, description, metadata)
    VALUES (
      (SELECT auth.uid()),
      'status_changed',
      'project',
      NEW.id,
      format('Project "%s" status: %s → %s', NEW.title, OLD.status, NEW.status),
      jsonb_build_object('before', OLD.status::TEXT, 'after', NEW.status::TEXT)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_status_change
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_status_change();


-- ────────────────────────────────────────────────────────────────────────────
-- §5  DESIGN REVIEW NOTIFICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_design_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the design creator
    IF NEW.created_by IS DISTINCT FROM (SELECT auth.uid()) THEN
      INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id, action_url)
      VALUES (
        NEW.created_by,
        CASE NEW.status
          WHEN 'approved' THEN 'Design Approved'
          WHEN 'rejected' THEN 'Design Rejected'
          WHEN 'revision_requested' THEN 'Revision Requested'
          WHEN 'in_review' THEN 'Design Under Review'
          ELSE 'Design Status Updated'
        END,
        format('"%s" (v%s) is now %s', NEW.title, NEW.version, REPLACE(NEW.status::TEXT, '_', ' ')),
        'status_change',
        'design',
        NEW.id,
        format('/dashboard/projects/%s', NEW.project_id)
      );
    END IF;

    -- Log activity
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, description, metadata)
    VALUES (
      (SELECT auth.uid()),
      'status_changed',
      'design',
      NEW.id,
      format('Design "%s" v%s: %s → %s', NEW.title, NEW.version, OLD.status, NEW.status),
      jsonb_build_object(
        'before', OLD.status::TEXT,
        'after', NEW.status::TEXT,
        'project_id', NEW.project_id::TEXT
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_design_status_change
  AFTER UPDATE OF status ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_status_change();


-- ────────────────────────────────────────────────────────────────────────────
-- §6  COMMENT NOTIFICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_title TEXT;
  v_author_name TEXT;
  v_notify_user_id UUID;
BEGIN
  -- Get author name
  SELECT full_name INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- Get entity title for context
  CASE NEW.entity_type
    WHEN 'project' THEN
      SELECT title INTO v_entity_title FROM public.projects WHERE id = NEW.entity_id;
    WHEN 'design' THEN
      SELECT title INTO v_entity_title FROM public.designs WHERE id = NEW.entity_id;
    WHEN 'presentation' THEN
      SELECT title INTO v_entity_title FROM public.presentations WHERE id = NEW.entity_id;
    ELSE
      v_entity_title := NEW.entity_type;
  END CASE;

  -- If this is a reply, notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_notify_user_id
    FROM public.comments
    WHERE id = NEW.parent_id;

    IF v_notify_user_id IS DISTINCT FROM NEW.author_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id, action_url)
      VALUES (
        v_notify_user_id,
        format('%s replied to your comment', v_author_name),
        left(NEW.content, 100),
        'comment',
        NEW.entity_type,
        NEW.entity_id,
        NULL
      );
    END IF;
  END IF;

  -- Log activity
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, description, metadata)
  VALUES (
    NEW.author_id,
    'commented',
    NEW.entity_type,
    NEW.entity_id,
    format('%s commented on %s "%s"', v_author_name, NEW.entity_type, COALESCE(v_entity_title, 'item')),
    jsonb_build_object('comment_id', NEW.id::TEXT, 'preview', left(NEW.content, 200))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();


-- ────────────────────────────────────────────────────────────────────────────
-- §7  PROJECT MEMBER ASSIGNMENT NOTIFICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
  v_assigner_name TEXT;
BEGIN
  SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;

  IF NEW.assigned_by IS NOT NULL THEN
    SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;
  ELSE
    v_assigner_name := 'System';
  END IF;

  -- Notify the assigned user (not the assigner)
  IF NEW.user_id IS DISTINCT FROM NEW.assigned_by THEN
    INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id, action_url)
    VALUES (
      NEW.user_id,
      'Added to Project',
      format('%s added you to "%s" as %s', v_assigner_name, v_project_title, NEW.role),
      'assignment',
      'project',
      NEW.project_id,
      format('/dashboard/projects/%s', NEW.project_id)
    );
  END IF;

  -- Log activity
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, description, metadata)
  VALUES (
    COALESCE(NEW.assigned_by, NEW.user_id),
    'assigned',
    'project',
    NEW.project_id,
    format('Assigned user to project "%s" as %s', v_project_title, NEW.role),
    jsonb_build_object('assigned_user_id', NEW.user_id::TEXT, 'role', NEW.role)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_member_assigned
  AFTER INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_assignment();


-- ────────────────────────────────────────────────────────────────────────────
-- §8  PRESENTATION VIEW COUNTER
-- ────────────────────────────────────────────────────────────────────────────
-- This is called from the application layer, not an automatic trigger.
-- Separate function avoids RLS issues and provides atomic increment.

CREATE OR REPLACE FUNCTION public.increment_presentation_views(p_share_token TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentations
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE share_token = p_share_token
    AND status = 'published'
    AND (share_expires_at IS NULL OR share_expires_at > now());
$$;

COMMENT ON FUNCTION public.increment_presentation_views IS 'Atomically increments the view count of a published presentation. Called from application layer.';


-- ────────────────────────────────────────────────────────────────────────────
-- §9  MARK NOTIFICATIONS READ (batch)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = now()
  WHERE id = ANY(p_notification_ids)
    AND user_id = (SELECT auth.uid())
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.mark_notifications_read IS 'Batch marks notifications as read for the current user. Returns count updated.';


-- ────────────────────────────────────────────────────────────────────────────
-- §10  MARK ALL NOTIFICATIONS READ
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = now()
  WHERE user_id = (SELECT auth.uid())
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- §11  LOG ACTIVITY (callable from application layer)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action      public.activity_action,
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_description TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, description, metadata)
  VALUES ((SELECT auth.uid()), p_action, p_entity_type, p_entity_id, p_description, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_activity IS 'Records an activity log entry for the current user. Use from Server Actions for non-trigger events.';
