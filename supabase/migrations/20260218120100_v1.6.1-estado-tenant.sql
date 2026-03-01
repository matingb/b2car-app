DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'tenants'
			AND column_name = 'fecha_actualizacion'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'tenants'
			AND column_name = 'updated_at'
	) THEN
		ALTER TABLE public.tenants
			RENAME COLUMN fecha_actualizacion TO updated_at;
	END IF;
END $$;

CREATE OR REPLACE FUNCTION public.custom_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
	claims        jsonb;
	tenant_uuid   uuid;
	tenant_name   text;
	user_id       uuid;
	user_role     text;
	tenant_estado text;
BEGIN
	claims := event->'claims';

	IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
		RETURN event;
	END IF;

	user_id := (claims->>'sub')::uuid;

	-- Buscar membresía (ideal: que sea la "activa" si tenés más de una)
	SELECT tm.tenant_id, tm.rol
		INTO tenant_uuid, user_role
	FROM public.tenant_members tm
	WHERE tm.cliente_id = user_id
	LIMIT 1;

	IF tenant_uuid IS NULL THEN
		-- Sin tenant => no dejamos loguear (opcional; si preferís, devolvé event normal)
		claims := claims
			|| jsonb_build_object('error', 'NO_TENANT')
			|| jsonb_build_object('error_description', 'El usuario no tiene un tenant asignado.');
		event := jsonb_set(event, '{claims}', claims);
		RETURN event;
	END IF;

	-- Traer tenant SOLO si está activo
	SELECT t.nombre, t.estado
		INTO tenant_name, tenant_estado
	FROM public.tenants t
	WHERE t.id = tenant_uuid
		AND t.estado = 'activo';

	IF tenant_name IS NULL THEN
		-- Tenant inexistente o no activo => bloquear login
		claims := claims
			|| jsonb_build_object('error', 'TENANT_INACTIVE')
			|| jsonb_build_object('error_description', 'El tenant está inactivo o no existe.');
		event := jsonb_set(event, '{claims}', claims);
		RETURN event;
	END IF;

	claims := claims
		|| jsonb_build_object('tenant_id', tenant_uuid)
		|| jsonb_build_object('user_role', user_role)
		|| jsonb_build_object('tenant_name', tenant_name);

	event := jsonb_set(event, '{claims}', claims);

	RETURN event;
END;
$$;
