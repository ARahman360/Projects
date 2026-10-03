-- Narrow compatibility migration while RLS is maintained outside Prisma's
-- contract. Does not alter policies, grants, existing option rows or markers.
ALTER TABLE public."menuItemOption"
  ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false;
