CREATE OR REPLACE FUNCTION public.dashboard_pick_bucket (
  p_from timestamp with time zone,
  p_to   timestamp with time zone,
  OUT    trunc_name text,
  OUT    label_fmt text,
  OUT    step interval
)
  RETURNS record
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_months int;
BEGIN
  v_months := (EXTRACT(YEAR FROM p_to)::int  - EXTRACT(YEAR FROM p_from)::int) * 12
            + (EXTRACT(MONTH FROM p_to)::int - EXTRACT(MONTH FROM p_from)::int);
  IF v_months <= 1 THEN
    trunc_name := 'day';   label_fmt := 'DD';    step := interval '1 day';
  ELSIF v_months <= 3 THEN
    trunc_name := 'week';  label_fmt := 'DD/MM'; step := interval '1 week';
  ELSE
    trunc_name := 'month'; label_fmt := 'MM/YY'; step := interval '1 month';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_pick_bucket"(timestamp WITH time zone, timestamp WITH time zone) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_pick_bucket"(timestamp WITH time zone, timestamp WITH time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_pick_bucket"(timestamp WITH time zone, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_pick_bucket"(timestamp WITH time zone, timestamp WITH time zone) TO "postgres";
