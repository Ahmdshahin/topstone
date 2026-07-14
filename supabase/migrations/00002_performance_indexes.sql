-- Add indexes for frequently queried foreign keys
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_measurements_project_id ON public.measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_designs_project_id ON public.designs(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON public.comments(project_id);

-- Add index for the secure presentation share token lookup
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(share_token);

-- Update RLS to ensure fast lookups
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
