-- ============================================================================
-- FACADE PRESENTATION SYSTEM — ROLE RENAME
-- Migration: 00007_rename_manager_to_sales_engineer
-- Description: Renames 'manager' enum value to 'sales_engineer' to match
--              the business domain terminology (Sales Engineer role).
-- ============================================================================

-- §1  Rename the enum value
ALTER TYPE public.user_role RENAME VALUE 'manager' TO 'sales_engineer';

-- §2  Create properly named helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_sales_engineer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'sales_engineer')
    AND is_active = TRUE
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_sales_engineer
  IS 'RLS helper: returns true if the authenticated user has admin or sales_engineer role.';

-- §3  Update the backward-compatible alias (keeps existing RLS policies working)
--     All 45+ policies reference is_admin_or_manager() — this alias prevents
--     a cascade of policy rewrites while remaining functionally correct.
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_sales_engineer();
$$;

COMMENT ON FUNCTION public.is_admin_or_manager
  IS 'Backward-compatible alias for is_admin_or_sales_engineer(). Used by existing RLS policies.';
