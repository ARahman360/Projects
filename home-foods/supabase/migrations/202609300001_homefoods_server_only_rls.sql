-- Home Foods uses server sessions and server-side Prisma, not Supabase Auth.
-- No direct anon/authenticated access is required, including for marketplace data.
-- Apply transactionally with scripts/database-security.mjs --apply.
-- Do not FORCE RLS: the trusted backend role retains existing route authorization.
DO $security$
DECLARE
  table_name text;
  column_name text;
  tables text[] := ARRAY['address','adminAuditLog','cart','cartItem','checkoutRequest','delivery','favorite','kitchenFavorite','menuCategory','menuItem','menuItemOption','newsletterSubscriber','notification','order','orderItem','orderStatusEvent','passwordResetToken','payment','review','rider','scheduledMeal','scheduledMealEvent','shop','subscription','subscriptionPlan','subscriptionPlanItem','user'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolbypassrls) THEN
    RAISE EXCEPTION 'Expected trusted backend role with BYPASSRLS; review runtime before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT(c.relname=ANY(tables))) THEN
    RAISE EXCEPTION 'Unreviewed public table: audit and extend migration before applying';
  END IF;
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    -- Column grants survive table-level REVOKE; remove those as well.
    FOR column_name IN SELECT a.attname FROM pg_attribute a
      WHERE a.attrelid=format('public.%I',table_name)::regclass AND a.attnum>0 AND NOT a.attisdropped LOOP
      EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',
        column_name,column_name,column_name,column_name,table_name);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS homefoods_server_only ON public.%I',table_name);
    EXECUTE format('CREATE POLICY homefoods_server_only ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',table_name);
  END LOOP;
END
$security$;
-- Prevent sequence use and accidental exposure of future tables created by this role.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
