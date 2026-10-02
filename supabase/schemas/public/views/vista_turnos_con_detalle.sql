CREATE VIEW "public"."vista_turnos_con_detalle" WITH (security_invoker=on) AS  SELECT t.id,
    t.titulo,
    t.fecha,
    t.hora,
    t.duracion,
    t.taller_id,
    tal.nombre AS taller_nombre,
    tal.ubicacion AS taller_ubicacion,
    t.vehiculo_id,
    t.cliente_id,
    t.tipo,
    t.estado,
    t.descripcion,
    t.observaciones,
    v.id AS vehiculo_id_full,
    v.cliente_id AS vehiculo_cliente_id,
    v.patente,
    v.marca,
    v.modelo,
    v.fecha_patente,
    v.nro_interno,
    c.id AS cliente_id_full,
    c.tipo_cliente,
    p.nombre AS particular_nombre,
    p.apellido AS particular_apellido,
    p.telefono AS particular_telefono,
    p.email AS particular_email,
    p.direccion AS particular_direccion,
    e.nombre AS empresa_nombre,
    e.telefono AS empresa_telefono,
    e.email AS empresa_email,
    e.direccion AS empresa_direccion,
    e.cuit AS empresa_cuit,
    v.numero_chasis,
    t.tenant_id,
    COALESCE(NULLIF(TRIM(BOTH FROM concat(p.nombre, ' ', p.apellido)), ''::text), NULLIF(TRIM(BOTH FROM e.nombre), ''::text)) AS cliente_nombre,
    COALESCE(NULLIF(TRIM(BOTH FROM p.email), ''::text), NULLIF(TRIM(BOTH FROM e.email), ''::text)) AS cliente_email,
    (tn.nombre)::text AS tenant_nombre,
    p.codigo_pais AS particular_codigo_pais,
    e.codigo_pais AS empresa_codigo_pais
   FROM ((((((public.turnos t
     LEFT JOIN public.talleres tal ON ((t.taller_id = tal.id)))
     LEFT JOIN public.vehiculos v ON ((t.vehiculo_id = v.id)))
     LEFT JOIN public.clientes c ON ((t.cliente_id = c.id)))
     LEFT JOIN public.particulares p ON ((c.id = p.id)))
     LEFT JOIN public.empresas e ON ((c.id = e.id)))
     LEFT JOIN public.tenants tn ON ((t.tenant_id = tn.id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_turnos_con_detalle" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_turnos_con_detalle" TO "service_role";

REVOKE ALL ON TABLE "public"."vista_turnos_con_detalle" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_turnos_con_detalle" TO "postgres";
