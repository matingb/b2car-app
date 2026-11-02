CREATE FUNCTION public.dashboard_pick_bucket (
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
  v_days numeric;
BEGIN
  v_days := EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0;
  IF v_days <= 35 THEN
    trunc_name := 'day';   label_fmt := 'DD';    step := interval '1 day';
  ELSIF v_days <= 100 THEN
    trunc_name := 'week';  label_fmt := 'DD/MM'; step := interval '1 week';
  ELSE
    trunc_name := 'month'; label_fmt := 'MM/YY'; step := interval '1 month';
  END IF;
END;
$function$;

GRANT ALL ON FUNCTION public.dashboard_pick_bucket(timestamp WITH time zone, timestamp WITH time zone) TO anon;

GRANT ALL ON FUNCTION public.dashboard_pick_bucket(timestamp WITH time zone, timestamp WITH time zone) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_pick_bucket(timestamp WITH time zone, timestamp WITH time zone) TO service_role;