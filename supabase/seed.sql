-- Datos ficticios de prueba para entorno local
-- Ordenado para respetar claves foráneas y restricciones

BEGIN;

SET search_path = public;

-- Limpieza (solo tablas públicas)
TRUNCATE TABLE
  empleados,
  detalle_form_custom,
  formularios,
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
INSERT INTO public.tenants (id, nombre, estado, fecha_creacion, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'B2Car', 'activo', now() - interval '180 days', now() - interval '1 day');

-- Formularios (config dinamica)
INSERT INTO public.formularios (tenant_id, descripcion, metadata)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'FormDev',
  $$[
    {
      "title": "Frenos delanteros",
      "inputs": [
        {"title": "Estado",   "default": "",     "required": true,  "component": "input"},
        {"title": "Potencia", "default": "50%",  "options": ["25%","50%","75%"], "component": "selector"},
        {"title": "Recambio", "default": false,  "required": true,  "component": "checkbox"}
      ]
    },
    {
      "title": "Frenos traseros",
      "inputs": [
        {"title": "Estado",   "default": "",     "required": true,  "component": "input"},
        {"title": "Potencia", "default": "50%",  "options": ["25%","50%","75%"], "component": "selector"}
      ]
    }
  ]$$::jsonb
);

-- Usuarios (auth.users) para cumplir FK de tenant_members
INSERT INTO "auth"."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES
  ('00000000-0000-0000-0000-000000000000','7ff568f8-4d46-463b-969c-9e68157fa769','authenticated','authenticated','local@user.ar','$2a$10$bK5BZ1QuOXlYfYXBkzT8p.LNOFLOM4r2nlM6Rs06dWq091Vzuakt6','2026-01-30 04:58:59.318335+00',null,'',null,'',null,'','',null,null,'{"provider":"email","providers":["email"]}','{"email_verified":true}',null,'2026-01-30 04:58:59.311336+00','2026-01-30 04:58:59.31893+00',null,null,'','',null,'','0',null,'',null,'false',null,'false'),
  ('00000000-0000-0000-0000-000000000000','4cdb1c76-3673-4731-b955-cd405f6903ab','authenticated','authenticated','nachoromero84@hotmail.com','$2a$10$SPtcDqHKCexPaYPKShCGg.yrrGamZqNgUjGsOliHI/kmJxxaAYc8C','2026-01-30 05:06:13.496442+00',null,'',null,'',null,'','',null,null,'{"provider":"email","providers":["email"]}','{"email_verified":true}',null,'2026-01-30 05:06:13.491833+00','2026-01-30 05:06:13.497031+00',null,null,'','',null,'','0',null,'',null,'false',null,'false'),
  ('00000000-0000-0000-0000-000000000000','8dfa870f-6d1c-4261-851c-64a192c66ca6','authenticated','authenticated','garzangb@gmail.com','$2a$10$y2fhrgzDT67G0B52ab/u1ucZfZvstGKtDQG8ggDPLU4ssaUWZTXPu','2026-01-30 05:07:52.277168+00',null,'',null,'',null,'','',null,null,'{"provider":"email","providers":["email"]}','{"email_verified":true}',null,'2026-01-30 05:07:52.272941+00','2026-01-30 05:07:52.277686+00',null,null,'','',null,'','0',null,'',null,'false',null,'false');

-- Tenant members
INSERT INTO "public"."tenant_members" ("cliente_id","tenant_id","rol") VALUES
  ('7ff568f8-4d46-463b-969c-9e68157fa769','11111111-1111-1111-1111-111111111111','admin'),
  ('4cdb1c76-3673-4731-b955-cd405f6903ab','11111111-1111-1111-1111-111111111111','admin'),
  ('8dfa870f-6d1c-4261-851c-64a192c66ca6','11111111-1111-1111-1111-111111111111','admin');

-- Clientes base (20: 10 particulares + 10 empresas)
INSERT INTO public.clientes (id, tipo_cliente, puntaje, fecha_creacion, tenant_id) VALUES
  ('10000000-0000-0000-0000-000000000001','particular',12, now() - interval '150 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000002','particular',5,  now() - interval '140 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000003','particular',8,  now() - interval '130 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000004','particular',3,  now() - interval '120 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000005','particular',10, now() - interval '110 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000006','particular',6,  now() - interval '100 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000007','particular',9,  now() - interval '90 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000008','particular',4,  now() - interval '80 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000009','particular',7,  now() - interval '70 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000010','particular',2,  now() - interval '60 days', '11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000101','empresa',   30, now() - interval '160 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000102','empresa',   18, now() - interval '155 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000103','empresa',   22, now() - interval '150 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000104','empresa',   14, now() - interval '145 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000105','empresa',   27, now() - interval '140 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000106','empresa',   11, now() - interval '135 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000107','empresa',   19, now() - interval '130 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000108','empresa',   16, now() - interval '125 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000109','empresa',   24, now() - interval '120 days','11111111-1111-1111-1111-111111111111'),
  ('10000000-0000-0000-0000-000000000110','empresa',   13, now() - interval '115 days','11111111-1111-1111-1111-111111111111');

-- Particulares (10)
INSERT INTO public.particulares (id, nombre, apellido, telefono, email, created_at, direccion) VALUES
  ('10000000-0000-0000-0000-000000000001','Lucia',   'Gomez',  '341-555-1001','lucia.gomez@test.com',  now() - interval '150 days','San Martin 1200'),
  ('10000000-0000-0000-0000-000000000002','Diego',   'Perez',  '341-555-1002','diego.perez@test.com',  now() - interval '140 days','Maipu 350'),
  ('10000000-0000-0000-0000-000000000003','Sofia',   'Ruiz',   '341-555-1003','sofia.ruiz@test.com',   now() - interval '130 days','Belgrano 890'),
  ('10000000-0000-0000-0000-000000000004','Pablo',   'Mendez', '341-555-1004','pablo.mendez@test.com', now() - interval '120 days','Cochabamba 410'),
  ('10000000-0000-0000-0000-000000000005','Carla',   'Lopez',  '341-555-1005','carla.lopez@test.com',  now() - interval '110 days','Italia 220'),
  ('10000000-0000-0000-0000-000000000006','Ezequiel','Diaz',   '341-555-1006','eze.diaz@test.com',     now() - interval '100 days','España 1050'),
  ('10000000-0000-0000-0000-000000000007','Valeria', 'Suarez', '341-555-1007','valeria.suarez@test.com',now() - interval '90 days','Rioja 300'),
  ('10000000-0000-0000-0000-000000000008','Martin',  'Vega',   '341-555-1008','martin.vega@test.com',  now() - interval '80 days', 'Salta 800'),
  ('10000000-0000-0000-0000-000000000009','Noelia',  'Torres', '341-555-1009','noelia.torres@test.com',now() - interval '70 days', 'Cordoba 560'),
  ('10000000-0000-0000-0000-000000000010','Gaston',  'Rios',   '341-555-1010','gaston.rios@test.com',  now() - interval '60 days', 'Mendoza 920');

-- Empresas (10)
INSERT INTO public.empresas (id, cuit, direccion, nombre, email, created_at, telefono) VALUES
  ('10000000-0000-0000-0000-000000000101','30-71234567-8','Calle Falsa 123',      'Autopartes Norte SA',   'contacto@autopartesnorte.test', now() - interval '160 days','341-555-1101'),
  ('10000000-0000-0000-0000-000000000102','30-72345678-9','Av. Siempre Viva 742', 'Flota Urbana SRL',      'info@flotaurbana.test',         now() - interval '155 days','341-555-1102'),
  ('10000000-0000-0000-0000-000000000103','30-73456789-0','Ruta 9 Km 12',         'Logistica Centro SA',   'ventas@logisticacentro.test',   now() - interval '150 days','341-555-1103'),
  ('10000000-0000-0000-0000-000000000104','30-74567890-1','Bv. Oroño 1550',       'Servicios Urbanos SA',  'contacto@serviciosurbanos.test',now() - interval '145 days','341-555-1104'),
  ('10000000-0000-0000-0000-000000000105','30-75678901-2','Urquiza 450',          'Fleet Manager SRL',     'info@fleetmanager.test',        now() - interval '140 days','341-555-1105'),
  ('10000000-0000-0000-0000-000000000106','30-76789012-3','Tucuman 600',          'Distribuciones Litoral','ventas@litoral.test',           now() - interval '135 days','341-555-1106'),
  ('10000000-0000-0000-0000-000000000107','30-77890123-4','San Juan 210',         'Mantenimiento SA',      'info@mantenimiento.test',       now() - interval '130 days','341-555-1107'),
  ('10000000-0000-0000-0000-000000000108','30-78901234-5','Italia 980',           'Transporte Sur SRL',    'contacto@transportesur.test',   now() - interval '125 days','341-555-1108'),
  ('10000000-0000-0000-0000-000000000109','30-79012345-6','Salta 112',            'Camiones Express',      'ventas@camionesexpress.test',   now() - interval '120 days','341-555-1109'),
  ('10000000-0000-0000-0000-000000000110','30-70123456-7','Mendoza 300',          'Servicios Andinos',     'info@serviciosandinos.test',    now() - interval '115 days','341-555-1110');

-- Representantes (10)
INSERT INTO public.representantes (id, empresa_id, nombre, apellido, telefono, created_at) VALUES
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000101','Marina', 'Lopez', '341-555-1111',now() - interval '150 days'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000102','Pablo',  'Diaz',  '341-555-1112',now() - interval '145 days'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000103','Elena',  'Silva', '341-555-1113',now() - interval '140 days'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000104','Lucas',  'Mora',  '341-555-1114',now() - interval '135 days'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000105','Ana',    'Vidal', '341-555-1115',now() - interval '130 days'),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000106','Nicolas','Ibarra','341-555-1116',now() - interval '125 days'),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000107','Julieta','Rey',   '341-555-1117',now() - interval '120 days'),
  ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000108','Facundo','Paz',   '341-555-1118',now() - interval '115 days'),
  ('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000109','Marta',  'Sosa',  '341-555-1119',now() - interval '110 days'),
  ('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000110','Pedro',  'Rivas', '341-555-1120',now() - interval '105 days');

-- Vehiculos (10)
INSERT INTO public.vehiculos (id, cliente_id, patente, marca, modelo, created_at, fecha_patente, tenant_id, numero_chasis, nro_interno) VALUES
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ABC123','Toyota',   'Corolla', now() - interval '160 days','2018','11111111-1111-1111-1111-111111111111','CHS-0001','VN-001'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','DEF456','Ford',     'Fiesta',  now() - interval '155 days','2016','11111111-1111-1111-1111-111111111111','CHS-0002','VN-002'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','GHI789','VW',       'Amarok',  now() - interval '150 days','2020','11111111-1111-1111-1111-111111111111','CHS-0003','VN-003'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','JKL321','Renault',  'Kwid',    now() - interval '145 days','2019','11111111-1111-1111-1111-111111111111','CHS-0004','VN-004'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','MNO654','Peugeot',  '208',     now() - interval '140 days','2021','11111111-1111-1111-1111-111111111111','CHS-0005','VN-005'),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006','PQR987','Honda',    'Fit',     now() - interval '135 days','2017','11111111-1111-1111-1111-111111111111','CHS-0006','VN-006'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000007','STU111','Chevrolet','Onix',    now() - interval '130 days','2022','11111111-1111-1111-1111-111111111111','CHS-0007','VN-007'),
  ('40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000008','VWX222','Nissan',   'March',   now() - interval '125 days','2015','11111111-1111-1111-1111-111111111111','CHS-0008','VN-008'),
  ('40000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009','YZA333','Kia',      'Rio',     now() - interval '120 days','2016','11111111-1111-1111-1111-111111111111','CHS-0009','VN-009'),
  ('40000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000010','BCD444','Fiat',     'Cronos',  now() - interval '115 days','2023','11111111-1111-1111-1111-111111111111','CHS-0010','VN-010');

-- Talleres (3)
INSERT INTO public.talleres (id, tenant_id, nombre, ubicacion, created_at, updated_at) VALUES
  ('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Sede Central',   'Av. Colon 120', now() - interval '180 days',now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Sucursal Oeste', 'Mitre 450',     now() - interval '160 days',now() - interval '2 days'),
  ('50000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sucursal Sur',   'San Juan 99',   now() - interval '150 days',now() - interval '3 days');

-- Empleados (3) - sueldos en pesos argentinos
INSERT INTO public.empleados (id, tenant_id, taller_id, nombre, apellido, dni, salario, fecha_ingreso) VALUES
  ('e1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Juan',   'Rodriguez','28345678',180000,'2024-12-01'),
  ('e1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Maria',  'Fernandez','31456789',155000,'2025-02-01'),
  ('e1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','Carlos', 'Gimenez',  '35678901',140000,'2025-05-01');

-- Productos (10)
INSERT INTO public.productos (id, tenant_id, codigo, nombre, marca, modelo, descripcion, precio_unitario, costo_unitario, proveedor, categorias, created_at, updated_at) VALUES
  ('60000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ACE-5W30', 'Aceite 5W30',     'Shell',   'Helix', 'Aceite sintético 1L',    6500, 4200,'Distribuidora Norte',ARRAY['lubricantes'],now() - interval '160 days',now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','FIL-AIR',  'Filtro de aire',  'Bosch',   'FA-123','Filtro estándar',         4200, 2500,'Distribuidora Norte',ARRAY['filtros'],     now() - interval '155 days',now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','BAT-55',   'Batería 55Ah',    'ACME',    'B55',   'Batería sellada',        68000,52000,'Baterias SA',        ARRAY['electricidad'],now() - interval '150 days',now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','ACE-10W40','Aceite 10W40',    'Total',   'Quartz','Semisintético 1L',        5200, 3500,'Distribuidora Norte',ARRAY['lubricantes'],now() - interval '145 days',now() - interval '4 days'),
  ('60000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','BUJ-IR',   'Bujía Iridium',   'NGK',     'IR-9',  'Bujía alto rendimiento',  5200, 3200,'NGK SA',             ARRAY['encendido'],  now() - interval '140 days',now() - interval '5 days'),
  ('60000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','FRE-PAD',  'Pastillas freno', 'Brembo',  'P200',  'Juego delantero',         9800, 6400,'Brembo AR',          ARRAY['frenos'],     now() - interval '135 days',now() - interval '6 days'),
  ('60000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','LIM-PA',   'Limpiaparabrisas','Valeo',   'V-24',  'Par 24"',                 3200, 1800,'Valeo SA',           ARRAY['accesorios'], now() - interval '130 days',now() - interval '7 days'),
  ('60000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','CAB-NEG',  'Cable negativo',  'ACME',    'CB-01', 'Cable batería',           2100, 1200,'ACME',               ARRAY['electricidad'],now() - interval '125 days',now() - interval '8 days'),
  ('60000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','REF-COOL', 'Refrigerante',    'Prestone','RX',    'Refrigerante 1L',         4300, 2600,'Prestone SA',        ARRAY['fluidos'],    now() - interval '120 days',now() - interval '9 days'),
  ('60000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','ACE-0W20', 'Aceite 0W20',     'Mobil',   '1',     'Aceite sintético 1L',     7000, 4800,'Mobil SA',           ARRAY['lubricantes'],now() - interval '115 days',now() - interval '10 days');

-- Stocks (10) - cantidades altas para que los deltas no rompan
INSERT INTO public.stocks (id, tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo, created_at, updated_at) VALUES
  ('70000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',200,10,300,now() - interval '160 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002',150, 5,200,now() - interval '155 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003', 80, 2,100,now() - interval '150 days',now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000004',180, 8,250,now() - interval '145 days',now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000005',120, 4,160,now() - interval '140 days',now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000006',100, 3,130,now() - interval '135 days',now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000007',200,10,300,now() - interval '130 days',now() - interval '4 days'),
  ('70000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000008',160, 5,200,now() - interval '125 days',now() - interval '4 days'),
  ('70000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000009',140, 6,180,now() - interval '120 days',now() - interval '5 days'),
  ('70000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000010',120, 4,160,now() - interval '115 days',now() - interval '5 days');

-- ===========================================================================
-- ARREGLOS: 6 meses de historia (mes -5 a mes actual)
-- Usamos date_trunc('month', now() - N * interval '1 month') + D días
-- Para el mes actual: hasta hoy (18 días del mes)
-- ===========================================================================

-- Mes actual (Mayo 2026): 10 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO',  date_trunc('month',now())+interval '2 days', 125000,true, 'Service completo',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '2 days',now()-interval '2 days','Cambio aceite y filtros'),
  ('80000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO',  date_trunc('month',now())+interval '4 days', 95000, true, 'Revisión frenos',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '4 days',now()-interval '2 days','Cambio pastillas'),
  ('80000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','Service',   'TERMINADO',  date_trunc('month',now())+interval '5 days', 80000, true, 'Service rápido',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '5 days',now()-interval '2 days','Alineación y balanceo'),
  ('80000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Diagnóstico','TERMINADO', date_trunc('month',now())+interval '7 days', 50000, true, 'Diagnóstico',         '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '7 days',now()-interval '1 day', 'Chequeo general'),
  ('80000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002','Aceite',    'TERMINADO',  date_trunc('month',now())+interval '8 days', 65000, true, 'Aceite y filtro',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '8 days',now()-interval '1 day', 'Cambio aceite'),
  ('80000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000003','Batería',   'TERMINADO',  date_trunc('month',now())+interval '10 days',100000,true, 'Cambio batería',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '10 days',now()-interval '1 day','Reemplazo batería'),
  ('80000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','Frenos',    'EN_PROGRESO',date_trunc('month',now())+interval '12 days',145000,false,'Frenos completos',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '12 days',now()-interval '1 day','Pastillas y discos'),
  ('80000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002','Luces',     'TERMINADO',  date_trunc('month',now())+interval '14 days',35000, true, 'Luces delanteras',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '14 days',now(),               'Cambio lámparas'),
  ('80000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000003','Alineación','EN_PROGRESO',date_trunc('month',now())+interval '16 days',55000, false,'Alineación',          '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '16 days',now(),               'Alineación y balanceo'),
  ('80000000-0000-0000-0000-000000000010','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000001','Service',   'ESPERA',     date_trunc('month',now())+interval '18 days',60000, false,'Service básico',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '18 days',now(),               'Service básico');

-- Mes -1 (Abril 2026): 8 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000011','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '3 days', 118000,true,'Service completo',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '3 days', date_trunc('month',now()-interval '1 month')+interval '4 days', 'Cambio aceite'),
  ('80000000-0000-0000-0000-000000000012','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '6 days', 88000, true,'Revisión frenos',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '6 days', date_trunc('month',now()-interval '1 month')+interval '7 days', 'Pastillas'),
  ('80000000-0000-0000-0000-000000000013','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','Diagnóstico','TERMINADO', date_trunc('month',now()-interval '1 month')+interval '9 days', 45000, true,'Diagnóstico',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '9 days', date_trunc('month',now()-interval '1 month')+interval '10 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000014','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Aceite',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '12 days',62000, true,'Aceite y filtro',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '12 days',date_trunc('month',now()-interval '1 month')+interval '13 days','Cambio aceite'),
  ('80000000-0000-0000-0000-000000000015','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002','Service',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '15 days',132000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '15 days',date_trunc('month',now()-interval '1 month')+interval '16 days','Service completo'),
  ('80000000-0000-0000-0000-000000000016','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000003','Batería',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '18 days',98000, true,'Cambio batería',   '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '18 days',date_trunc('month',now()-interval '1 month')+interval '19 days','Batería nueva'),
  ('80000000-0000-0000-0000-000000000017','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','Frenos',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '22 days',140000,true,'Frenos completos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '22 days',date_trunc('month',now()-interval '1 month')+interval '23 days','Discos y pastillas'),
  ('80000000-0000-0000-0000-000000000018','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002','Alineación','TERMINADO', date_trunc('month',now()-interval '1 month')+interval '26 days',52000, true,'Alineación',       '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '26 days',date_trunc('month',now()-interval '1 month')+interval '27 days','Alineación completa');

-- Mes -2 (Marzo 2026): 7 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000019','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '4 days', 110000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '4 days', date_trunc('month',now()-interval '2 months')+interval '5 days', 'Service'),
  ('80000000-0000-0000-0000-000000000020','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '8 days', 82000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '8 days', date_trunc('month',now()-interval '2 months')+interval '9 days', 'Pastillas'),
  ('80000000-0000-0000-0000-000000000021','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003','Aceite',    'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '11 days',58000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '11 days',date_trunc('month',now()-interval '2 months')+interval '12 days','Aceite'),
  ('80000000-0000-0000-0000-000000000022','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','Diagnóstico','TERMINADO', date_trunc('month',now()-interval '2 months')+interval '14 days',48000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '14 days',date_trunc('month',now()-interval '2 months')+interval '15 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000023','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000002','Service',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '18 days',125000,true,'Service completo','11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '18 days',date_trunc('month',now()-interval '2 months')+interval '19 days','Service completo'),
  ('80000000-0000-0000-0000-000000000024','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003','Batería',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '22 days',92000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '22 days',date_trunc('month',now()-interval '2 months')+interval '23 days','Batería'),
  ('80000000-0000-0000-0000-000000000025','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Luces',     'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '26 days',32000, true,'Luces delanteras','11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '26 days',date_trunc('month',now()-interval '2 months')+interval '27 days','Lámparas');

-- Mes -3 (Febrero 2026): 6 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000026','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '5 days', 105000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '5 days', date_trunc('month',now()-interval '3 months')+interval '6 days', 'Service'),
  ('80000000-0000-0000-0000-000000000027','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '10 days',78000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '10 days',date_trunc('month',now()-interval '3 months')+interval '11 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000028','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000003','Aceite',    'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '13 days',55000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '13 days',date_trunc('month',now()-interval '3 months')+interval '14 days','Aceite'),
  ('80000000-0000-0000-0000-000000000029','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Diagnóstico','TERMINADO', date_trunc('month',now()-interval '3 months')+interval '18 days',42000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '18 days',date_trunc('month',now()-interval '3 months')+interval '19 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000030','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','Batería',   'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '22 days',88000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '22 days',date_trunc('month',now()-interval '3 months')+interval '23 days','Batería nueva'),
  ('80000000-0000-0000-0000-000000000031','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003','Alineación','TERMINADO', date_trunc('month',now()-interval '3 months')+interval '26 days',48000, true,'Alineación',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '26 days',date_trunc('month',now()-interval '3 months')+interval '27 days','Alineación');

-- Mes -4 (Enero 2026): 5 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000032','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '7 days', 98000, true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '7 days', date_trunc('month',now()-interval '4 months')+interval '8 days', 'Service'),
  ('80000000-0000-0000-0000-000000000033','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '12 days',72000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '12 days',date_trunc('month',now()-interval '4 months')+interval '13 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000034','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003','Aceite',    'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '17 days',52000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '17 days',date_trunc('month',now()-interval '4 months')+interval '18 days','Aceite'),
  ('80000000-0000-0000-0000-000000000035','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Diagnóstico','TERMINADO', date_trunc('month',now()-interval '4 months')+interval '21 days',40000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '21 days',date_trunc('month',now()-interval '4 months')+interval '22 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000036','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000002','Batería',   'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '26 days',85000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '26 days',date_trunc('month',now()-interval '4 months')+interval '27 days','Batería');

-- Mes -5 (Diciembre 2025): 4 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, tipo, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000037','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000001','Service',   'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '5 days', 90000, true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '5 days', date_trunc('month',now()-interval '5 months')+interval '6 days', 'Service'),
  ('80000000-0000-0000-0000-000000000038','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000002','Frenos',    'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '12 days',68000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '12 days',date_trunc('month',now()-interval '5 months')+interval '13 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000039','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','Aceite',    'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '18 days',48000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '18 days',date_trunc('month',now()-interval '5 months')+interval '19 days','Aceite'),
  ('80000000-0000-0000-0000-000000000040','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','Diagnóstico','TERMINADO', date_trunc('month',now()-interval '5 months')+interval '24 days',38000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '24 days',date_trunc('month',now()-interval '5 months')+interval '25 days','Chequeo');

-- ===========================================================================
-- OPERACIONES: ASIGNACION_ARREGLO con fecha = fecha del arreglo
-- Solo para arreglos del mes actual y mes -1 (para el detalle de repuestos)
-- ===========================================================================

-- ASIGNACION_ARREGLO - Mes actual (5 arreglos con repuestos)
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now())+interval '2 days'),
  ('90000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now())+interval '4 days'),
  ('90000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000003',date_trunc('month',now())+interval '5 days'),
  ('90000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now())+interval '7 days'),
  ('90000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now())+interval '8 days');

-- ASIGNACION_ARREGLO - Mes -1 Abril (4 arreglos con repuestos)
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '1 month')+interval '3 days'),
  ('90000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '1 month')+interval '6 days'),
  ('90000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '1 month')+interval '15 days'),
  ('90000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '1 month')+interval '22 days');

-- ASIGNACION_ARREGLO - Mes -2 Marzo (3 arreglos con repuestos)
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '2 months')+interval '4 days'),
  ('90000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '2 months')+interval '8 days'),
  ('90000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000003',date_trunc('month',now()-interval '2 months')+interval '18 days');

-- ASIGNACION_ARREGLO - Meses -3, -4, -5 (2 por mes)
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '3 months')+interval '5 days'),
  ('90000000-0000-0000-0000-000000000019','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '3 months')+interval '22 days'),
  ('90000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '4 months')+interval '7 days'),
  ('90000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '4 months')+interval '12 days'),
  ('90000000-0000-0000-0000-000000000022','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '5 months')+interval '5 days'),
  ('90000000-0000-0000-0000-000000000023','11111111-1111-1111-1111-111111111111','ASIGNACION_ARREGLO','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '5 months')+interval '12 days');

-- COMPRA operaciones - 2 por mes, 6 meses
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  -- Mes actual (Mayo)
  ('90000000-0000-0000-0000-000000000100','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now())+interval '1 days'),
  ('90000000-0000-0000-0000-000000000101','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000002',date_trunc('month',now())+interval '9 days'),
  -- Mes -1 (Abril)
  ('90000000-0000-0000-0000-000000000102','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '1 month')+interval '2 days'),
  ('90000000-0000-0000-0000-000000000103','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000003',date_trunc('month',now()-interval '1 month')+interval '20 days'),
  -- Mes -2 (Marzo)
  ('90000000-0000-0000-0000-000000000104','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '2 months')+interval '3 days'),
  ('90000000-0000-0000-0000-000000000105','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '2 months')+interval '19 days'),
  -- Mes -3 (Febrero)
  ('90000000-0000-0000-0000-000000000106','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '3 months')+interval '8 days'),
  ('90000000-0000-0000-0000-000000000107','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '3 months')+interval '22 days'),
  -- Mes -4 (Enero)
  ('90000000-0000-0000-0000-000000000108','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '4 months')+interval '10 days'),
  ('90000000-0000-0000-0000-000000000109','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000003',date_trunc('month',now()-interval '4 months')+interval '24 days'),
  -- Mes -5 (Diciembre)
  ('90000000-0000-0000-0000-000000000110','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '5 months')+interval '7 days'),
  ('90000000-0000-0000-0000-000000000111','11111111-1111-1111-1111-111111111111','COMPRA','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '5 months')+interval '20 days');

-- VENTA operaciones - 1 por mes, 6 meses
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000200','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000002',date_trunc('month',now())+interval '6 days'),
  ('90000000-0000-0000-0000-000000000201','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '1 month')+interval '14 days'),
  ('90000000-0000-0000-0000-000000000202','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000003',date_trunc('month',now()-interval '2 months')+interval '16 days'),
  ('90000000-0000-0000-0000-000000000203','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000001',date_trunc('month',now()-interval '3 months')+interval '12 days'),
  ('90000000-0000-0000-0000-000000000204','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000002',date_trunc('month',now()-interval '4 months')+interval '18 days'),
  ('90000000-0000-0000-0000-000000000205','11111111-1111-1111-1111-111111111111','VENTA','50000000-0000-0000-0000-000000000003',date_trunc('month',now()-interval '5 months')+interval '15 days');

-- ===========================================================================
-- OPERACIONES_LINEAS
-- Stocks Taller Central (001): 70000...001, 002, 003
-- Stocks Taller Oeste  (002): 70000...004, 005, 006, 007
-- Stocks Taller Sur    (003): 70000...008, 009, 010
-- delta_cantidad negativo = salida de stock
-- ===========================================================================

-- ASIGNACION_ARREGLO lineas (mes actual)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001', 2, 6500,-2),
  ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000004', 1, 9800,-1),
  ('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000008', 1,68000,-1),
  ('91000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000002', 2, 4200,-2),
  ('91000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000005', 1, 5200,-1);

-- ASIGNACION_ARREGLO lineas (mes -1, Abril)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000011','70000000-0000-0000-0000-000000000001', 2, 6500,-2),
  ('91000000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000012','70000000-0000-0000-0000-000000000005', 1, 5200,-1),
  ('91000000-0000-0000-0000-000000000013','90000000-0000-0000-0000-000000000013','70000000-0000-0000-0000-000000000002', 3, 4200,-3),
  ('91000000-0000-0000-0000-000000000014','90000000-0000-0000-0000-000000000014','70000000-0000-0000-0000-000000000006', 2, 9800,-2);

-- ASIGNACION_ARREGLO lineas (mes -2, Marzo)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000015','90000000-0000-0000-0000-000000000015','70000000-0000-0000-0000-000000000001', 2, 6500,-2),
  ('91000000-0000-0000-0000-000000000016','90000000-0000-0000-0000-000000000016','70000000-0000-0000-0000-000000000004', 1, 5200,-1),
  ('91000000-0000-0000-0000-000000000017','90000000-0000-0000-0000-000000000017','70000000-0000-0000-0000-000000000009', 1, 4300,-1);

-- ASIGNACION_ARREGLO lineas (meses -3, -4, -5)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000018','90000000-0000-0000-0000-000000000018','70000000-0000-0000-0000-000000000001', 2, 6500,-2),
  ('91000000-0000-0000-0000-000000000019','90000000-0000-0000-0000-000000000019','70000000-0000-0000-0000-000000000004', 1, 5200,-1),
  ('91000000-0000-0000-0000-000000000020','90000000-0000-0000-0000-000000000020','70000000-0000-0000-0000-000000000001', 1, 6500,-1),
  ('91000000-0000-0000-0000-000000000021','90000000-0000-0000-0000-000000000021','70000000-0000-0000-0000-000000000005', 1, 5200,-1),
  ('91000000-0000-0000-0000-000000000022','90000000-0000-0000-0000-000000000022','70000000-0000-0000-0000-000000000002', 2, 4200,-2),
  ('91000000-0000-0000-0000-000000000023','90000000-0000-0000-0000-000000000023','70000000-0000-0000-0000-000000000004', 1, 9800,-1);

-- COMPRA lineas (reposición de stock, 6 meses)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  -- Mayo
  ('91000000-0000-0000-0000-000000000100','90000000-0000-0000-0000-000000000100','70000000-0000-0000-0000-000000000001',30,4200, 30),
  ('91000000-0000-0000-0000-000000000101','90000000-0000-0000-0000-000000000101','70000000-0000-0000-0000-000000000005',20,3200, 20),
  -- Abril
  ('91000000-0000-0000-0000-000000000102','90000000-0000-0000-0000-000000000102','70000000-0000-0000-0000-000000000001',25,4200, 25),
  ('91000000-0000-0000-0000-000000000103','90000000-0000-0000-0000-000000000103','70000000-0000-0000-0000-000000000009',15,2600, 15),
  -- Marzo
  ('91000000-0000-0000-0000-000000000104','90000000-0000-0000-0000-000000000104','70000000-0000-0000-0000-000000000004',20,3500, 20),
  ('91000000-0000-0000-0000-000000000105','90000000-0000-0000-0000-000000000105','70000000-0000-0000-0000-000000000002',30,2500, 30),
  -- Febrero
  ('91000000-0000-0000-0000-000000000106','90000000-0000-0000-0000-000000000106','70000000-0000-0000-0000-000000000001',20,4200, 20),
  ('91000000-0000-0000-0000-000000000107','90000000-0000-0000-0000-000000000107','70000000-0000-0000-0000-000000000005',15,3200, 15),
  -- Enero
  ('91000000-0000-0000-0000-000000000108','90000000-0000-0000-0000-000000000108','70000000-0000-0000-0000-000000000001',15,4200, 15),
  ('91000000-0000-0000-0000-000000000109','90000000-0000-0000-0000-000000000109','70000000-0000-0000-0000-000000000009',10,2600, 10),
  -- Diciembre
  ('91000000-0000-0000-0000-000000000110','90000000-0000-0000-0000-000000000110','70000000-0000-0000-0000-000000000001',10,4200, 10),
  ('91000000-0000-0000-0000-000000000111','90000000-0000-0000-0000-000000000111','70000000-0000-0000-0000-000000000004',10,3500, 10);

-- VENTA lineas (venta directa de repuestos, 6 meses)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000200','90000000-0000-0000-0000-000000000200','70000000-0000-0000-0000-000000000004', 3, 5200,-3),
  ('91000000-0000-0000-0000-000000000201','90000000-0000-0000-0000-000000000201','70000000-0000-0000-0000-000000000005', 2, 5200,-2),
  ('91000000-0000-0000-0000-000000000202','90000000-0000-0000-0000-000000000202','70000000-0000-0000-0000-000000000009', 2, 4300,-2),
  ('91000000-0000-0000-0000-000000000203','90000000-0000-0000-0000-000000000203','70000000-0000-0000-0000-000000000001', 3, 6500,-3),
  ('91000000-0000-0000-0000-000000000204','90000000-0000-0000-0000-000000000204','70000000-0000-0000-0000-000000000004', 2, 5200,-2),
  ('91000000-0000-0000-0000-000000000205','90000000-0000-0000-0000-000000000205','70000000-0000-0000-0000-000000000008', 1, 2100,-1);

-- ===========================================================================
-- VINCULOS OPERACION - ARREGLO
-- ===========================================================================

-- Mes actual
INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES
  ('90000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000003'),
  ('90000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000004'),
  ('90000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000005');

-- Mes -1 (Abril)
INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES
  ('90000000-0000-0000-0000-000000000011','80000000-0000-0000-0000-000000000011'),
  ('90000000-0000-0000-0000-000000000012','80000000-0000-0000-0000-000000000012'),
  ('90000000-0000-0000-0000-000000000013','80000000-0000-0000-0000-000000000015'),
  ('90000000-0000-0000-0000-000000000014','80000000-0000-0000-0000-000000000017');

-- Mes -2 (Marzo)
INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES
  ('90000000-0000-0000-0000-000000000015','80000000-0000-0000-0000-000000000019'),
  ('90000000-0000-0000-0000-000000000016','80000000-0000-0000-0000-000000000020'),
  ('90000000-0000-0000-0000-000000000017','80000000-0000-0000-0000-000000000023');

-- Meses -3 a -5
INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES
  ('90000000-0000-0000-0000-000000000018','80000000-0000-0000-0000-000000000026'),
  ('90000000-0000-0000-0000-000000000019','80000000-0000-0000-0000-000000000028'),
  ('90000000-0000-0000-0000-000000000020','80000000-0000-0000-0000-000000000032'),
  ('90000000-0000-0000-0000-000000000021','80000000-0000-0000-0000-000000000033'),
  ('90000000-0000-0000-0000-000000000022','80000000-0000-0000-0000-000000000037'),
  ('90000000-0000-0000-0000-000000000023','80000000-0000-0000-0000-000000000038');

-- Turnos (10)
INSERT INTO public.turnos (id, fecha, hora, duracion, vehiculo_id, cliente_id, tenant_id, tipo, estado, descripcion, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001',current_date-3,'09:00',60,'40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Service',   'finalizado','Service programado',now()-interval '4 days',now()-interval '3 days'),
  ('a0000000-0000-0000-0000-000000000002',current_date-2,'10:30',45,'40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Frenos',    'finalizado','Revisión de frenos', now()-interval '3 days',now()-interval '2 days'),
  ('a0000000-0000-0000-0000-000000000003',current_date-1,'12:00',30,'40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Luces',     'finalizado','Chequeo luces',      now()-interval '2 days',now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000004',current_date,  '09:30',60,'40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Diagnóstico','confirmado','Diagnóstico general',now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000005',current_date+1,'11:00',45,'40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Aceite',    'pendiente', 'Cambio aceite',      now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000006',current_date+2,'13:00',60,'40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Batería',   'pendiente', 'Revisión batería',   now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000007',current_date+3,'14:00',45,'40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Frenos',    'pendiente', 'Revisión frenos',    now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000008',current_date+4,'10:00',30,'40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Alineación','pendiente', 'Alineación',         now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000009',current_date+5,'15:00',60,'40000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','Service',   'pendiente', 'Service rápido',     now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000010',current_date+6,'09:00',45,'40000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Service',   'pendiente', 'Service programado', now()-interval '1 day', now()-interval '1 day');

COMMIT;
