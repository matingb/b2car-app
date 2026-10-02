CREATE VIEW "public"."vista_vehiculos_con_clientes" WITH (security_invoker=on) AS  SELECT v.id,
    COALESCE(NULLIF(TRIM(BOTH FROM concat(p.nombre, ' ', p.apellido)), ''::text), e.nombre) AS nombre_cliente,
    v.patente,
    v.marca,
    v.modelo,
    v.fecha_patente,
    v.nro_interno,
    v.numero_chasis,
    v.cliente_id,
    v.color,
    v.numero_motor
   FROM (((public.vehiculos v
     JOIN public.clientes c ON ((v.cliente_id = c.id)))
     LEFT JOIN public.particulares p ON ((c.id = p.id)))
     LEFT JOIN public.empresas e ON ((c.id = e.id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_vehiculos_con_clientes" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_vehiculos_con_clientes" TO "service_role";

REVOKE ALL ON TABLE "public"."vista_vehiculos_con_clientes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vista_vehiculos_con_clientes" TO "postgres";
