-- Datos ficticios de prueba para entorno local
-- Ordenado para respetar claves foráneas y restricciones

BEGIN;

SET search_path = public;

-- Limpieza (solo tablas públicas)
TRUNCATE TABLE
  operaciones_asignacion_arreglo,
  operaciones_lineas,
  operaciones,
  arreglos,
  turnos,
  stocks,
  productos,
  talleres,
  vehiculos,
  representantes,
  empresas,
  particulares,
  clientes,
  tenant_members,
  tenants
RESTART IDENTITY CASCADE;

-- Tenants (solo uno)
INSERT INTO public.tenants (id, nombre, estado, fecha_creacion, fecha_actualizacion) VALUES
  ('11111111-1111-1111-1111-111111111111', 'B2Car', 'activo', now() - interval '120 days', now() - interval '1 day');

-- Usuarios (auth.users) para cumplir FK de tenant_members
-- Nota: en Supabase los campos no listados tienen defaults.
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000', '7ff568f8-4d46-463b-969c-9e68157fa769', 'authenticated', 'authenticated', 'local@user.ar', '$2a$10$bK5BZ1QuOXlYfYXBkzT8p.LNOFLOM4r2nlM6Rs06dWq091Vzuakt6', '2026-01-30 04:58:59.318335+00', null, '', null, '', null, '', '', null, null, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', null, '2026-01-30 04:58:59.311336+00', '2026-01-30 04:58:59.31893+00', null, null, '', '', null, '', '0', null, '', null, 'false', null, 'false');
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000', '4cdb1c76-3673-4731-b955-cd405f6903ab', 'authenticated', 'authenticated', 'nachoromero84@hotmail.com', '$2a$10$SPtcDqHKCexPaYPKShCGg.yrrGamZqNgUjGsOliHI/kmJxxaAYc8C', '2026-01-30 05:06:13.496442+00', null, '', null, '', null, '', '', null, null, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', null, '2026-01-30 05:06:13.491833+00', '2026-01-30 05:06:13.497031+00', null, null, '', '', null, '', '0', null, '', null, 'false', null, 'false');
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000', '8dfa870f-6d1c-4261-851c-64a192c66ca6', 'authenticated', 'authenticated', 'garzangb@gmail.com', '$2a$10$y2fhrgzDT67G0B52ab/u1ucZfZvstGKtDQG8ggDPLU4ssaUWZTXPu', '2026-01-30 05:07:52.277168+00', null, '', null, '', null, '', '', null, null, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', null, '2026-01-30 05:07:52.272941+00', '2026-01-30 05:07:52.277686+00', null, null, '', '', null, '', '0', null, '', null, 'false', null, 'false');

-- Tenant members
INSERT INTO "public"."tenant_members" ("cliente_id", "tenant_id", "rol") VALUES ('7ff568f8-4d46-463b-969c-9e68157fa769', '11111111-1111-1111-1111-111111111111', 'admin');
INSERT INTO "public"."tenant_members" ("cliente_id", "tenant_id", "rol") VALUES ('4cdb1c76-3673-4731-b955-cd405f6903ab', '11111111-1111-1111-1111-111111111111', 'admin');
INSERT INTO "public"."tenant_members" ("cliente_id", "tenant_id", "rol") VALUES ('8dfa870f-6d1c-4261-851c-64a192c66ca6', '11111111-1111-1111-1111-111111111111', 'admin');


-- Clientes (base) - 20 registros (10 particulares + 10 empresas)
INSERT INTO public.clientes (id, tipo_cliente, puntaje, fecha_creacion, tenant_id) VALUES
  ('10000000-0000-0000-0000-000000000001', 'particular', 12, now() - interval '90 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000002', 'particular', 5,  now() - interval '85 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000003', 'particular', 8,  now() - interval '80 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000004', 'particular', 3,  now() - interval '75 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000005', 'particular', 10, now() - interval '70 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000006', 'particular', 6,  now() - interval '65 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000007', 'particular', 9,  now() - interval '60 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000008', 'particular', 4,  now() - interval '55 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000009', 'particular', 7,  now() - interval '50 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000010', 'particular', 2,  now() - interval '45 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000101', 'empresa',    30, now() - interval '100 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000102', 'empresa',    18, now() - interval '95 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000103', 'empresa',    22, now() - interval '90 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000104', 'empresa',    14, now() - interval '85 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000105', 'empresa',    27, now() - interval '80 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000106', 'empresa',    11, now() - interval '75 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000107', 'empresa',    19, now() - interval '70 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000108', 'empresa',    16, now() - interval '65 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000109', 'empresa',    24, now() - interval '60 days',  '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000110', 'empresa',    13, now() - interval '55 days',  '11111111-1111-1111-1111-111111111111');

-- Particulares (10)
INSERT INTO public.particulares (id, nombre, apellido, telefono, email, created_at, direccion) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Lucia',  'Gomez',  '341-555-1001', 'lucia.gomez@test.com',  now() - interval '90 days', 'San Martin 1200'),
  ('10000000-0000-0000-0000-000000000002', 'Diego',  'Perez',  '341-555-1002', 'diego.perez@test.com',  now() - interval '85 days', 'Maipu 350'),
  ('10000000-0000-0000-0000-000000000003', 'Sofia',  'Ruiz',   '341-555-1003', 'sofia.ruiz@test.com',   now() - interval '80 days', 'Belgrano 890'),
  ('10000000-0000-0000-0000-000000000004', 'Pablo',  'Mendez', '341-555-1004', 'pablo.mendez@test.com', now() - interval '75 days', 'Cochabamba 410'),
  ('10000000-0000-0000-0000-000000000005', 'Carla',  'Lopez',  '341-555-1005', 'carla.lopez@test.com',  now() - interval '70 days', 'Italia 220'),
  ('10000000-0000-0000-0000-000000000006', 'Ezequiel','Diaz',  '341-555-1006', 'eze.diaz@test.com',     now() - interval '65 days', 'España 1050'),
  ('10000000-0000-0000-0000-000000000007', 'Valeria','Suarez','341-555-1007', 'valeria.suarez@test.com', now() - interval '60 days', 'Rioja 300'),
  ('10000000-0000-0000-0000-000000000008', 'Martin', 'Vega',   '341-555-1008', 'martin.vega@test.com',  now() - interval '55 days', 'Salta 800'),
  ('10000000-0000-0000-0000-000000000009', 'Noelia', 'Torres', '341-555-1009', 'noelia.torres@test.com',now() - interval '50 days', 'Cordoba 560'),
  ('10000000-0000-0000-0000-000000000010', 'Gaston', 'Rios',   '341-555-1010', 'gaston.rios@test.com',  now() - interval '45 days', 'Mendoza 920');

-- Empresas (10)
INSERT INTO public.empresas (id, cuit, direccion, nombre, email, created_at, telefono) VALUES
  ('10000000-0000-0000-0000-000000000101', '30-71234567-8', 'Calle Falsa 123',     'Autopartes Norte SA', 'contacto@autopartesnorte.test', now() - interval '100 days', '341-555-1101'),
  ('10000000-0000-0000-0000-000000000102', '30-72345678-9', 'Av. Siempre Viva 742','Flota Urbana SRL',    'info@flotaurbana.test',        now() - interval '95 days',  '341-555-1102'),
  ('10000000-0000-0000-0000-000000000103', '30-73456789-0', 'Ruta 9 Km 12',        'Logistica Centro SA', 'ventas@logisticacentro.test',  now() - interval '90 days',  '341-555-1103'),
  ('10000000-0000-0000-0000-000000000104', '30-74567890-1', 'Bv. Oroño 1550',      'Servicios Urbanos SA','contacto@serviciosurbanos.test', now() - interval '85 days', '341-555-1104'),
  ('10000000-0000-0000-0000-000000000105', '30-75678901-2', 'Urquiza 450',         'Fleet Manager SRL',  'info@fleetmanager.test',       now() - interval '80 days',  '341-555-1105'),
  ('10000000-0000-0000-0000-000000000106', '30-76789012-3', 'Tucuman 600',         'Distribuciones Litoral', 'ventas@litoral.test',      now() - interval '75 days',  '341-555-1106'),
  ('10000000-0000-0000-0000-000000000107', '30-77890123-4', 'San Juan 210',        'Mantenimiento SA',   'info@mantenimiento.test',      now() - interval '70 days',  '341-555-1107'),
  ('10000000-0000-0000-0000-000000000108', '30-78901234-5', 'Italia 980',          'Transporte Sur SRL', 'contacto@transportesur.test',  now() - interval '65 days',  '341-555-1108'),
  ('10000000-0000-0000-0000-000000000109', '30-79012345-6', 'Salta 112',           'Camiones Express',   'ventas@camionesexpress.test',  now() - interval '60 days',  '341-555-1109'),
  ('10000000-0000-0000-0000-000000000110', '30-70123456-7', 'Mendoza 300',         'Servicios Andinos',  'info@serviciosandinos.test',   now() - interval '55 days',  '341-555-1110');

-- Representantes (10)
INSERT INTO public.representantes (id, empresa_id, nombre, apellido, telefono, created_at) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'Marina', 'Lopez',  '341-555-1111', now() - interval '90 days'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000102', 'Pablo',  'Diaz',   '341-555-1112', now() - interval '85 days'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000103', 'Elena',  'Silva',  '341-555-1113', now() - interval '80 days'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000104', 'Lucas',  'Mora',   '341-555-1114', now() - interval '75 days'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000105', 'Ana',    'Vidal',  '341-555-1115', now() - interval '70 days'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000106', 'Nicolas','Ibarra', '341-555-1116', now() - interval '65 days'),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000107', 'Julieta','Rey',    '341-555-1117', now() - interval '60 days'),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000108', 'Facundo','Paz',    '341-555-1118', now() - interval '55 days'),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000109', 'Marta',  'Sosa',   '341-555-1119', now() - interval '50 days'),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000110', 'Pedro',  'Rivas',  '341-555-1120', now() - interval '45 days');

-- Vehiculos (10)
INSERT INTO public.vehiculos (id, cliente_id, patente, marca, modelo, created_at, fecha_patente, tenant_id, nro_interno) VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ABC123', 'Toyota', 'Corolla', now() - interval '40 days', '2018', '11111111-1111-1111-1111-111111111111', 'VN-001'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'DEF456', 'Ford',   'Fiesta',  now() - interval '38 days', '2016', '11111111-1111-1111-1111-111111111111', 'VN-002'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'GHI789', 'VW',     'Amarok',  now() - interval '36 days', '2020', '11111111-1111-1111-1111-111111111111', 'VN-003'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'JKL321', 'Renault','Kwid',    now() - interval '34 days', '2019', '11111111-1111-1111-1111-111111111111', 'VN-004'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'MNO654', 'Peugeot','208',     now() - interval '32 days', '2021', '11111111-1111-1111-1111-111111111111', 'VN-005'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'PQR987', 'Honda',  'Fit',     now() - interval '30 days', '2017', '11111111-1111-1111-1111-111111111111', 'VN-006'),
  ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'STU111', 'Chevrolet','Onix',  now() - interval '28 days', '2022', '11111111-1111-1111-1111-111111111111', 'VN-007'),
  ('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', 'VWX222', 'Nissan', 'March',   now() - interval '26 days', '2015', '11111111-1111-1111-1111-111111111111', 'VN-008'),
  ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'YZA333', 'Kia',    'Rio',     now() - interval '24 days', '2016', '11111111-1111-1111-1111-111111111111', 'VN-009'),
  ('40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000010', 'BCD444', 'Fiat',   'Cronos',  now() - interval '22 days', '2023', '11111111-1111-1111-1111-111111111111', 'VN-010');

-- Talleres (solo tres)
INSERT INTO public.talleres (id, tenant_id, nombre, ubicacion, created_at, updated_at) VALUES
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sede Central',  'Av. Colon 120', now() - interval '120 days', now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sucursal Oeste', 'Mitre 450',      now() - interval '100 days', now() - interval '2 days'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Sucursal Sur',   'San Juan 99',    now() - interval '90 days',  now() - interval '3 days');

-- Productos (10)
INSERT INTO public.productos (id, tenant_id, codigo, nombre, marca, modelo, descripcion, precio_unitario, costo_unitario, proveedor, categorias, created_at, updated_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ACE-5W30',  'Aceite 5W30',     'Shell',   'Helix',  'Aceite sintético 1L', 6500, 4200, 'Distribuidora Norte', ARRAY['lubricantes'], now() - interval '90 days', now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'FIL-AIR',   'Filtro de aire',  'Bosch',   'FA-123', 'Filtro estándar',      4200, 2500, 'Distribuidora Norte', ARRAY['filtros'],     now() - interval '85 days', now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'BAT-55',    'Batería 55Ah',    'ACME',    'B55',    'Batería sellada',     68000, 52000, 'Baterias SA',        ARRAY['electricidad'], now() - interval '80 days', now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'ACE-10W40', 'Aceite 10W40',    'Total',   'Quartz', 'Semisintético 1L',    5200, 3500, 'Distribuidora Norte', ARRAY['lubricantes'], now() - interval '75 days', now() - interval '4 days'),
  ('60000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'BUJ-IR',    'Bujía Iridium',   'NGK',     'IR-9',   'Bujía alto rendimiento', 5200, 3200, 'NGK SA',             ARRAY['encendido'],  now() - interval '70 days', now() - interval '5 days'),
  ('60000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'FRE-PAD',   'Pastillas freno', 'Brembo',  'P200',   'Juego delantero',     9800, 6400, 'Brembo AR',           ARRAY['frenos'],      now() - interval '65 days', now() - interval '6 days'),
  ('60000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'LIM-PA',    'Limpiaparabrisas','Valeo',  'V-24',   'Par 24"',            3200, 1800, 'Valeo SA',            ARRAY['accesorios'],  now() - interval '60 days', now() - interval '7 days'),
  ('60000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'CAB-NEG',   'Cable negativo',  'ACME',    'CB-01',  'Cable batería',       2100, 1200, 'ACME',                ARRAY['electricidad'], now() - interval '55 days', now() - interval '8 days'),
  ('60000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'REF-COOL',  'Refrigerante',    'Prestone','RX',     'Refrigerante 1L',     4300, 2600, 'Prestone SA',         ARRAY['fluidos'],     now() - interval '50 days', now() - interval '9 days'),
  ('60000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'ACE-0W20',  'Aceite 0W20',     'Mobil',   '1',      'Aceite sintético 1L', 7000, 4800, 'Mobil SA',            ARRAY['lubricantes'], now() - interval '45 days', now() - interval '10 days');

-- Stocks (10)
INSERT INTO public.stocks (id, tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo, created_at, updated_at) VALUES
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 45, 10, 100, now() - interval '40 days', now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 20, 5,  60,  now() - interval '39 days', now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 8,  2,  20,  now() - interval '38 days', now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', 30, 8,  80,  now() - interval '37 days', now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000005', 15, 4,  40,  now() - interval '36 days', now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000006', 12, 3,  30,  now() - interval '35 days', now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000007', 50, 10, 120, now() - interval '34 days', now() - interval '4 days'),
  ('70000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000008', 18, 5,  50,  now() - interval '33 days', now() - interval '4 days'),
  ('70000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000009', 22, 6,  55,  now() - interval '32 days', now() - interval '5 days'),
  ('70000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000010', 14, 4,  40,  now() - interval '31 days', now() - interval '5 days');

-- Arreglos (10)
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, kilometraje_leido, fecha, observaciones, precio_final, precio_sin_iva, esta_pago, extra_data, created_at, descripcion, tenant_id, updated_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Service',  65200, now() - interval '15 days', 'Cambio de aceite y filtros', 120000, 99174, true,  '{"items":2}', now() - interval '15 days', 'Service completo', '11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('80000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Frenos',   48000, now() - interval '14 days', 'Cambio de pastillas',      90000,  74380, false, '{"items":1}', now() - interval '14 days', 'Revisión de frenos', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('80000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'Service',  30000, now() - interval '13 days', 'Alineación y balanceo',    75000,  61983, true,  '{"items":1}', now() - interval '13 days', 'Service rápido', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('80000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', 'Diagnóstico', 40500, now() - interval '12 days', 'Chequeo general', 45000, 37190, true, '{"items":1}', now() - interval '12 days', 'Diagnóstico', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('80000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', 'Aceite',   22000, now() - interval '11 days', 'Cambio aceite', 60000, 49587, false, '{"items":1}', now() - interval '11 days', 'Aceite y filtro', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('80000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', 'Batería',  50000, now() - interval '10 days', 'Reemplazo batería', 95000, 78512, true, '{"items":1}', now() - interval '10 days', 'Cambio batería', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('80000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000001', 'Frenos',   33000, now() - interval '9 days',  'Pastillas y discos', 140000, 115702, false, '{"items":2}', now() - interval '9 days', 'Frenos completos', '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('80000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000002', 'Luces',    41000, now() - interval '8 days',  'Cambio lámparas', 30000, 24793, true, '{"items":1}', now() - interval '8 days',  'Luces delanteras', '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('80000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000003', 'Alineación', 60000, now() - interval '7 days',  'Alineación y balanceo', 50000, 41322, true, '{"items":1}', now() - interval '7 days',  'Alineación', '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('80000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000001', 'Service',  15000, now() - interval '6 days',  'Service básico', 55000, 45455, false, '{"items":1}', now() - interval '6 days',  'Service básico', '11111111-1111-1111-1111-111111111111', now() - interval '1 day');

-- Operaciones (12)
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, created_at) VALUES
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001', now() - interval '12 days'),
  ('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002', now() - interval '11 days'),
  ('90000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000003', now() - interval '10 days'),
  ('90000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001', now() - interval '9 days'),
  ('90000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('90000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000003', now() - interval '7 days'),
  ('90000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('90000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('90000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000003', now() - interval '4 days'),
  ('90000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('90000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'COMPRA',            '50000000-0000-0000-0000-000000000001', now() - interval '20 days'),
  ('90000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'VENTA',             '50000000-0000-0000-0000-000000000002', now() - interval '2 days');

-- Operaciones líneas (12)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad, created_at) VALUES
  -- Taller 1 (stocks 700...001-003)
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 2,  6500, -2,  now() - interval '12 days'),
  -- Taller 2 (stocks 700...004-007)
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', 1,  4200, -1,  now() - interval '11 days'),
  -- Taller 3 (stocks 700...008-010)
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000008', 1, 52000, -1,  now() - interval '10 days'),
  -- Taller 1
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 2,  5200, -2,  now() - interval '9 days'),
  -- Taller 2
  ('91000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000005', 1,  5200, -1,  now() - interval '8 days'),
  -- Taller 3
  ('91000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000009', 1,  9800, -1,  now() - interval '7 days'),
  -- Taller 1
  ('91000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000003', 2,  3200, -2,  now() - interval '6 days'),
  -- Taller 2
  ('91000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000006', 1,  2100, -1,  now() - interval '5 days'),
  -- Taller 3
  ('91000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000010', 1,  4300, -1,  now() - interval '4 days'),
  -- Taller 1
  ('91000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000001', 1,  7000, -1,  now() - interval '3 days'),
  -- COMPRA taller 1
  ('91000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000001', 20, 4200,  20, now() - interval '20 days'),
  -- VENTA taller 2
  ('91000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000012', '70000000-0000-0000-0000-000000000004', 2,  4200, -2,  now() - interval '2 days');

-- Vinculo operacion-asignacion-arreglo (10)
INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES
  ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003'),
  ('90000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004'),
  ('90000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000005'),
  ('90000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000006'),
  ('90000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007'),
  ('90000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000008'),
  ('90000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009'),
  ('90000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000010');

-- Turnos (10)
INSERT INTO public.turnos (id, fecha, hora, duracion, vehiculo_id, cliente_id, tenant_id, tipo, estado, descripcion, observaciones, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', current_date - 5, '09:00', 60, '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Service',  'confirmado', 'Service programado', 'Traer llave de rueda', now() - interval '6 days', now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000002', current_date - 4, '10:30', 45, '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Frenos',   'finalizado', 'Revisión de frenos', NULL, now() - interval '5 days', now() - interval '4 days'),
  ('a0000000-0000-0000-0000-000000000003', current_date - 3, '12:00', 30, '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Luces',    'confirmado', 'Chequeo luces', 'Cambiar lámparas', now() - interval '4 days', now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000004', current_date - 2, '14:00', 60, '40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Diagnóstico', 'confirmado', 'Diagnóstico general', NULL, now() - interval '3 days', now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000005', current_date - 1, '16:30', 45, '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Aceite', 'confirmado', 'Cambio aceite', NULL, now() - interval '2 days', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000006', current_date, '09:30', 30, '40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Batería', 'pendiente', 'Revisión batería', NULL, now() - interval '1 day', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000007', current_date + 1, '11:00', 60, '40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Frenos', 'pendiente', 'Revisión frenos', NULL, now() - interval '1 day', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000008', current_date + 2, '13:00', 45, '40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Alineación', 'pendiente', 'Alineación', NULL, now() - interval '1 day', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000009', current_date + 3, '15:00', 30, '40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Service', 'pendiente', 'Service rápido', NULL, now() - interval '1 day', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000010', current_date + 4, '10:00', 60, '40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Service', 'pendiente', 'Service programado', 'Cliente espera', now() - interval '1 day', now() - interval '1 day');

COMMIT;
