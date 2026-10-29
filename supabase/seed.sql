-- Datos ficticios de prueba para entorno local
-- Ordenado para respetar claves foráneas y restricciones

BEGIN;

SET search_path = public;

-- Limpieza (solo tablas públicas)
TRUNCATE TABLE
  detalle_arreglo,
  categorias_arreglo,
  empleados,
  detalle_form_custom,
  formularios,
  operaciones_asignacion_arreglo,
  operaciones_lineas,
  movimientos_financieros,
  operaciones_movimiento_cuenta,
  cuentas_financieras,
  operaciones_venta,
  operaciones_compra,
  operaciones,
  arreglos,
  turnos,
  stocks,
  productos_proveedores,
  productos,
  proveedores,
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
INSERT INTO public.tenants (id, nombre, plan_sub, estado, fecha_creacion, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'B2Car', 'PRO', 'activo', now() - interval '19 months', now() - interval '1 day');

-- Cuentas Financieras (2 cuentas bancarias)
INSERT INTO public.cuentas_financieras (id, tenant_id, nombre, tipo, saldo, activo, favorita, created_at, updated_at) VALUES
  ('c0000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Banco Galicia',  'CUENTA_BANCARIA',0,true,true,now() - interval '19 months',now() - interval '19 months'),
  ('c0000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Banco Santander','CUENTA_BANCARIA',0,true,false,now() - interval '19 months',now() - interval '19 months');

-- Categorías de Arreglo por defecto
INSERT INTO public.categorias_arreglo (id, tenant_id, nombre) VALUES
  ('b1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Service'),
  ('b1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Frenos'),
  ('b1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Diagnóstico'),
  ('b1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Aceite'),
  ('b1000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Batería'),
  ('b1000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Luces'),
  ('b1000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Alineación'),
  ('b1000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Suspensión'),
  ('b1000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','Motor'),
  ('b1000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Electricidad');

-- Formularios (config dinamica)
INSERT INTO public.formularios (tenant_id, descripcion, metadata, categoria_arreglo_id)
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
  ]$$::jsonb,
  'b1000000-0000-0000-0000-000000000001'
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
-- El seed se ejecuta sin una sesion de Supabase. Se simula el claim que usan
-- los defaults de tenant_id para que los detalles se creen en B2Car.
SELECT set_config(
  'request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111"}',
  true
);

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

-- Talleres (3) con tarifa horaria por taller
INSERT INTO public.talleres (id, tenant_id, nombre, ubicacion, valor_hora, created_at, updated_at) VALUES
  ('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Sede Central',   'Av. Colon 120', 45000, now() - interval '19 months',now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Sucursal Oeste', 'Mitre 450',     50000, now() - interval '19 months',now() - interval '2 days'),
  ('50000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sucursal Sur',   'San Juan 99',   48000, now() - interval '19 months',now() - interval '3 days');

-- Empleados (4): cada taller tiene al menos un empleado; salarios y tarifas en pesos argentinos
INSERT INTO public.empleados (id, tenant_id, taller_id, nombre, apellido, dni, salario, valor_hora, fecha_ingreso) VALUES
  ('e1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Juan',   'Rodriguez','28345678',180000,12000,'2024-12-01'),
  ('e1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Maria',  'Fernandez','31456789',155000,10000,'2025-02-01'),
  ('e1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','Carlos', 'Gimenez',  '35678901',140000,11000,'2025-05-01'),
  ('e1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','Lucia',  'Perez',    '32456789',145000,10500,'2025-06-01');

INSERT INTO public.empleado_salarios (empleado_id, tenant_id, taller_id, salario, vigente_desde) VALUES
  ('e1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001',180000,'2024-12-01'),
  ('e1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001',155000,'2025-02-01'),
  ('e1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002',140000,'2025-05-01'),
  ('e1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003',145000,'2025-06-01');

-- Proveedores (1)
INSERT INTO public.proveedores (id, tenant_id, nombre, cuit, telefono, email, direccion, created_at, updated_at) VALUES
  ('d2000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Distribuidora Norte','30-71234567-8','11-4567-8900','ventas@distribuidoranorte.com','Av. Warnes 1540, CABA',now() - interval '180 days',now() - interval '1 day');

-- Productos (10)
INSERT INTO public.productos (id, tenant_id, codigo, nombre, marca, modelo, descripcion, precio_unitario, costo_unitario, proveedor, categorias, created_at, updated_at) VALUES
  ('60000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ACE-5W30', 'Aceite 5W30',     'Shell',   'Helix', 'Aceite sintético 1L',    6500, 4200,'Distribuidora Norte',ARRAY['Aceites y Lubricantes'],now() - interval '160 days',now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','FIL-AIR',  'Filtro de aire',  'Bosch',   'FA-123','Filtro estándar',         4200, 2500,'Distribuidora Norte',ARRAY['Filtros'],     now() - interval '155 days',now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','BAT-55',   'Batería 55Ah',    'ACME',    'B55',   'Batería sellada',        68000,52000,'Baterias SA',        ARRAY['Eléctrico'],now() - interval '150 days',now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','ACE-10W40','Aceite 10W40',    'Total',   'Quartz','Semisintético 1L',        5200, 3500,'Distribuidora Norte',ARRAY['Aceites y Lubricantes'],now() - interval '145 days',now() - interval '4 days'),
  ('60000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','BUJ-IR',   'Bujía Iridium',   'NGK',     'IR-9',  'Bujía alto rendimiento',  5200, 3200,'NGK SA',             ARRAY['Motor'],  now() - interval '140 days',now() - interval '5 days'),
  ('60000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','FRE-PAD',  'Pastillas freno', 'Brembo',  'P200',  'Juego delantero',         9800, 6400,'Brembo AR',          ARRAY['Frenos'],     now() - interval '135 days',now() - interval '6 days'),
  ('60000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','LIM-PA',   'Limpiaparabrisas','Valeo',   'V-24',  'Par 24"',                 3200, 1800,'Valeo SA',           ARRAY['Accesorios'], now() - interval '130 days',now() - interval '7 days'),
  ('60000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','CAB-NEG',  'Cable negativo',  'ACME',    'CB-01', 'Cable batería',           2100, 1200,'ACME',               ARRAY['Eléctrico'],now() - interval '125 days',now() - interval '8 days'),
  ('60000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','REF-COOL', 'Refrigerante',    'Prestone','RX',    'Refrigerante 1L',         4300, 2600,'Prestone SA',        ARRAY['Motor'],    now() - interval '120 days',now() - interval '9 days'),
  ('60000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','ACE-0W20', 'Aceite 0W20',     'Mobil',   '1',     'Aceite sintético 1L',     7000, 4800,'Mobil SA',           ARRAY['Aceites y Lubricantes'],now() - interval '115 days',now() - interval '10 days');

-- Catálogo Productos - Proveedores
INSERT INTO public.productos_proveedores (id, tenant_id, producto_id, proveedor_id, codigo_proveedor, costo_referencia, es_predeterminado, created_at, updated_at) VALUES
  ('d3000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','60000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','DN-ACE-5W30', 4200,true,now() - interval '160 days',now() - interval '1 day'),
  ('d3000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','60000000-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000001','DN-FIL-AIR',  2500,true,now() - interval '155 days',now() - interval '2 days'),
  ('d3000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','60000000-0000-0000-0000-000000000004','d2000000-0000-0000-0000-000000000001','DN-ACE-10W40',3500,true,now() - interval '145 days',now() - interval '4 days'),
  ('d3000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','60000000-0000-0000-0000-000000000006','d2000000-0000-0000-0000-000000000001','DN-FRE-PAD',  6400,true,now() - interval '135 days',now() - interval '6 days');

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
  ('70000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000010',120, 4,160,now() - interval '115 days',now() - interval '5 days'),
  -- Stocks adicionales para que el catálogo completo del proveedor Distribuidora Norte esté disponible en todos los talleres
  ('70000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004',120, 8,200,now() - interval '145 days',now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000006', 90, 3,130,now() - interval '135 days',now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001',100,10,200,now() - interval '160 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002', 80, 5,150,now() - interval '155 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001', 70,10,150,now() - interval '160 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000002', 60, 5,120,now() - interval '155 days',now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000004', 90, 8,150,now() - interval '145 days',now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000006', 50, 3,100,now() - interval '135 days',now() - interval '3 days');

-- ===========================================================================
-- ARREGLOS: 6 meses de historia (mes -5 a mes actual). Los meses -17 a -6 y
-- +1 a +6 se generan más abajo, en "HISTORIA EXTENDIDA PARA EL DASHBOARD".
-- Usamos date_trunc('month', now() - N * interval '1 month') + D días
-- Para el mes actual: hasta hoy (18 días del mes)
-- ===========================================================================

-- Mes actual (Mayo 2026): 10 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',   'TERMINADO',  date_trunc('month',now())+interval '2 days', 125000,true, 'Service completo',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '2 days',now()-interval '2 days','Cambio aceite y filtros'),
  ('80000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',    'TERMINADO',  date_trunc('month',now())+interval '4 days', 95000, true, 'Revisión frenos',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '4 days',now()-interval '2 days','Cambio pastillas'),
  ('80000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003',   'TERMINADO',  date_trunc('month',now())+interval '5 days', 80000, true, 'Service rápido',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '5 days',now()-interval '2 days','Alineación y balanceo'),
  ('80000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','TERMINADO', date_trunc('month',now())+interval '7 days', 50000, true, 'Diagnóstico',         '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '7 days',now()-interval '1 day', 'Chequeo general'),
  ('80000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002',    'TERMINADO',  date_trunc('month',now())+interval '8 days', 65000, true, 'Aceite y filtro',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '8 days',now()-interval '1 day', 'Cambio aceite'),
  ('80000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000003',   'TERMINADO',  date_trunc('month',now())+interval '10 days',100000,true, 'Cambio batería',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '10 days',now()-interval '1 day','Reemplazo batería'),
  ('80000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001',    'EN_PROGRESO',date_trunc('month',now())+interval '12 days',145000,false,'Frenos completos',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '12 days',now()-interval '1 day','Pastillas y discos'),
  ('80000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002',     'TERMINADO',  date_trunc('month',now())+interval '14 days',35000, true, 'Luces delanteras',    '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '14 days',now(),               'Cambio lámparas'),
  ('80000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000003','EN_PROGRESO',date_trunc('month',now())+interval '16 days',55000, false,'Alineación',          '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '16 days',now(),               'Alineación y balanceo'),
  ('80000000-0000-0000-0000-000000000010','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000001',   'ESPERA',     date_trunc('month',now())+interval '18 days',60000, false,'Service básico',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now())+interval '18 days',now(),               'Service básico');

-- Mes -1 (Abril 2026): 8 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000011','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '3 days', 118000,true,'Service completo',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '3 days', date_trunc('month',now()-interval '1 month')+interval '4 days', 'Cambio aceite'),
  ('80000000-0000-0000-0000-000000000012','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '6 days', 88000, true,'Revisión frenos',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '6 days', date_trunc('month',now()-interval '1 month')+interval '7 days', 'Pastillas'),
  ('80000000-0000-0000-0000-000000000013','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','TERMINADO', date_trunc('month',now()-interval '1 month')+interval '9 days', 45000, true,'Diagnóstico',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '9 days', date_trunc('month',now()-interval '1 month')+interval '10 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000014','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '12 days',62000, true,'Aceite y filtro',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '12 days',date_trunc('month',now()-interval '1 month')+interval '13 days','Cambio aceite'),
  ('80000000-0000-0000-0000-000000000015','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '15 days',132000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '15 days',date_trunc('month',now()-interval '1 month')+interval '16 days','Service completo'),
  ('80000000-0000-0000-0000-000000000016','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000003',   'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '18 days',98000, true,'Cambio batería',   '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '18 days',date_trunc('month',now()-interval '1 month')+interval '19 days','Batería nueva'),
  ('80000000-0000-0000-0000-000000000017','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001',    'TERMINADO', date_trunc('month',now()-interval '1 month')+interval '22 days',140000,true,'Frenos completos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '22 days',date_trunc('month',now()-interval '1 month')+interval '23 days','Discos y pastillas'),
  ('80000000-0000-0000-0000-000000000018','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002','TERMINADO', date_trunc('month',now()-interval '1 month')+interval '26 days',52000, true,'Alineación',       '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '1 month')+interval '26 days',date_trunc('month',now()-interval '1 month')+interval '27 days','Alineación completa');

-- Mes -2 (Marzo 2026): 7 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000019','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '4 days', 110000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '4 days', date_trunc('month',now()-interval '2 months')+interval '5 days', 'Service'),
  ('80000000-0000-0000-0000-000000000020','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002',    'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '8 days', 82000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '8 days', date_trunc('month',now()-interval '2 months')+interval '9 days', 'Pastillas'),
  ('80000000-0000-0000-0000-000000000021','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003',    'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '11 days',58000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '11 days',date_trunc('month',now()-interval '2 months')+interval '12 days','Aceite'),
  ('80000000-0000-0000-0000-000000000022','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','TERMINADO', date_trunc('month',now()-interval '2 months')+interval '14 days',48000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '14 days',date_trunc('month',now()-interval '2 months')+interval '15 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000023','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000002',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '18 days',125000,true,'Service completo','11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '18 days',date_trunc('month',now()-interval '2 months')+interval '19 days','Service completo'),
  ('80000000-0000-0000-0000-000000000024','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003',   'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '22 days',92000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '22 days',date_trunc('month',now()-interval '2 months')+interval '23 days','Batería'),
  ('80000000-0000-0000-0000-000000000025','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001',     'TERMINADO', date_trunc('month',now()-interval '2 months')+interval '26 days',32000, true,'Luces delanteras','11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '2 months')+interval '26 days',date_trunc('month',now()-interval '2 months')+interval '27 days','Lámparas');

-- Mes -3 (Febrero 2026): 6 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000026','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000001',   'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '5 days', 105000,true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '5 days', date_trunc('month',now()-interval '3 months')+interval '6 days', 'Service'),
  ('80000000-0000-0000-0000-000000000027','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000002',    'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '10 days',78000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '10 days',date_trunc('month',now()-interval '3 months')+interval '11 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000028','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000003',    'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '13 days',55000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '13 days',date_trunc('month',now()-interval '3 months')+interval '14 days','Aceite'),
  ('80000000-0000-0000-0000-000000000029','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','TERMINADO', date_trunc('month',now()-interval '3 months')+interval '18 days',42000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '18 days',date_trunc('month',now()-interval '3 months')+interval '19 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000030','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002',   'TERMINADO', date_trunc('month',now()-interval '3 months')+interval '22 days',88000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '22 days',date_trunc('month',now()-interval '3 months')+interval '23 days','Batería nueva'),
  ('80000000-0000-0000-0000-000000000031','40000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003','TERMINADO', date_trunc('month',now()-interval '3 months')+interval '26 days',48000, true,'Alineación',      '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '3 months')+interval '26 days',date_trunc('month',now()-interval '3 months')+interval '27 days','Alineación');

-- Mes -4 (Enero 2026): 5 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000032','40000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001',   'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '7 days', 98000, true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '7 days', date_trunc('month',now()-interval '4 months')+interval '8 days', 'Service'),
  ('80000000-0000-0000-0000-000000000033','40000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000002',    'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '12 days',72000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '12 days',date_trunc('month',now()-interval '4 months')+interval '13 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000034','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003',    'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '17 days',52000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '17 days',date_trunc('month',now()-interval '4 months')+interval '18 days','Aceite'),
  ('80000000-0000-0000-0000-000000000035','40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','TERMINADO', date_trunc('month',now()-interval '4 months')+interval '21 days',40000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '21 days',date_trunc('month',now()-interval '4 months')+interval '22 days','Chequeo'),
  ('80000000-0000-0000-0000-000000000036','40000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000002',   'TERMINADO', date_trunc('month',now()-interval '4 months')+interval '26 days',85000, true,'Cambio batería',  '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '4 months')+interval '26 days',date_trunc('month',now()-interval '4 months')+interval '27 days','Batería');

-- Mes -5 (Diciembre 2025): 4 arreglos
INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones) VALUES
  ('80000000-0000-0000-0000-000000000037','40000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000001',   'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '5 days', 90000, true,'Service completo', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '5 days', date_trunc('month',now()-interval '5 months')+interval '6 days', 'Service'),
  ('80000000-0000-0000-0000-000000000038','40000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000002',    'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '12 days',68000, true,'Revisión frenos', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '12 days',date_trunc('month',now()-interval '5 months')+interval '13 days','Pastillas'),
  ('80000000-0000-0000-0000-000000000039','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003',    'TERMINADO', date_trunc('month',now()-interval '5 months')+interval '18 days',48000, true,'Aceite y filtro', '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '18 days',date_trunc('month',now()-interval '5 months')+interval '19 days','Aceite'),
  ('80000000-0000-0000-0000-000000000040','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','TERMINADO', date_trunc('month',now()-interval '5 months')+interval '24 days',38000, true,'Diagnóstico',     '11111111-1111-1111-1111-111111111111',date_trunc('month',now()-interval '5 months')+interval '24 days',date_trunc('month',now()-interval '5 months')+interval '25 days','Chequeo');

-- ===========================================================================
-- DETALLE ARREGLO (Mano de obra con categoria_arreglo_id y empleado_id)
-- ===========================================================================
INSERT INTO public.detalle_arreglo (id, tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada, categoria_arreglo_id, empleado_id) VALUES
  -- Mes actual
  ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000001','Mano de obra cambio de aceite y filtros',1,45000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000001','Inspección general de fluidos y correas',1,67000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000002','Reemplazo pastillas de freno delanteras',1,85200,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000003','Alineación y balanceo 4 ruedas',         1,80000,'b1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000004','Diagnóstico computarizado escaneo ECU',  1,50000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000005','Mano de obra cambio de aceite y filtro',  1,59800,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000006','Colocación y prueba de carga de batería', 1,32000,'b1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000007','Rectificado de discos y frenos completos',1,145000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000008','Regulación y cambio ópticas delanteras', 1,35000,'b1000000-0000-0000-0000-000000000006','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000009','Alineación tren delantero',             1,55000,'b1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000010','Service básico preventivo',              1,60000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002'),

  -- Mes -1 (Abril)
  ('d0000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000011','Mano de obra service 10.000km',          1,105000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000012','Cambio de pastillas de freno traseras',  1,88000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000013','Chequeo sistema eléctrico',              1,45000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000014','Cambio de aceite sintético y filtros',    1,62000,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000015','Mano de obra service general',           1,132000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000016','Instalación de batería de 55Ah',       1,30000,'b1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000018','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000017','Reparación de calipers y pastillas',     1,140000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000019','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000018','Alineación y balanceo',                  1,52000,'b1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000003'),

  -- Mes -2 (Marzo)
  ('d0000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000019','Service programado',                   1,110000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000020','Cambio de líquido y pastillas',          1,82000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000022','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000021','Cambio de aceite y filtro 10W40',       1,58000,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000023','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000022','Diagnóstico de fallas en motor',        1,48000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000024','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000023','Mano de obra service completo',          1,125000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000025','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000024','Cambio de batería y chequeo alternador', 1,24000,'b1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000026','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000025','Mantenimiento de ópticas y luces',       1,32000,'b1000000-0000-0000-0000-000000000006','e1000000-0000-0000-0000-000000000002'),

  -- Mes -3 (Febrero)
  ('d0000000-0000-0000-0000-000000000027','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000026','Service completo de mantenimiento',      1,105000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000028','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000027','Revisión del sistema de frenado',         1,78000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000029','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000028','Cambio de aceite y filtro',              1,55000,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000029','Diagnóstico de computadora',              1,42000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000031','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000030','Reemplazo de batería',                    1,20000,'b1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000032','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000031','Alineación de neumáticos',               1,48000,'b1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000004'),

  -- Mes -4 (Enero)
  ('d0000000-0000-0000-0000-000000000033','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000032','Service integral de rutina',             1,98000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000034','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000033','Mano de obra cambio de pastillas',        1,72000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000035','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000034','Cambio de aceite semisintético',           1,52000,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000036','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000035','Diagnóstico mecánico general',             1,40000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000037','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000036','Colocación de batería',                   1,33000,'b1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000003'),

  -- Mes -5 (Diciembre)
  ('d0000000-0000-0000-0000-000000000038','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000037','Service preventivo de fin de año',         1,90000,'b1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000039','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000038','Mantenimiento de frenos',                1,68000,'b1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000040','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000039','Cambio de aceite express',                1,48000,'b1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000041','11111111-1111-1111-1111-111111111111','80000000-0000-0000-0000-000000000040','Diagnóstico general y escaneo',          1,38000,'b1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000002');

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

-- APERTURA_CUENTA operaciones - Saldo inicial para cuentas bancarias
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha) VALUES
  ('90000000-0000-0000-0000-000000000301','11111111-1111-1111-1111-111111111111','MOVIMIENTO_CUENTA',NULL,now() - interval '19 months'),
  ('90000000-0000-0000-0000-000000000302','11111111-1111-1111-1111-111111111111','MOVIMIENTO_CUENTA',NULL,now() - interval '19 months');

INSERT INTO public.operaciones_movimiento_cuenta (operacion_id, tenant_id, subtipo, cuenta_id, importe, created_by, created_at) VALUES
  ('90000000-0000-0000-0000-000000000301','11111111-1111-1111-1111-111111111111','APERTURA_CUENTA','c0000000-0000-4000-8000-000000000001',2500000,'7ff568f8-4d46-463b-969c-9e68157fa769',now() - interval '19 months'),
  ('90000000-0000-0000-0000-000000000302','11111111-1111-1111-1111-111111111111','APERTURA_CUENTA','c0000000-0000-4000-8000-000000000002',1800000,'7ff568f8-4d46-463b-969c-9e68157fa769',now() - interval '19 months');

-- Operaciones Compra vinculadas al proveedor
INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id) VALUES
  ('90000000-0000-0000-0000-000000000100','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000101','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000102','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000103','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000104','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000105','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000106','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000107','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000108','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000109','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000110','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000111','11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001');

-- ===========================================================================
-- OPERACIONES_LINEAS
-- Stocks Taller Central (001): 70000...001, 002, 003
-- Stocks Taller Oeste  (002): 70000...004, 005, 006, 007
-- Stocks Taller Sur    (003): 70000...008, 009, 010
-- delta_cantidad negativo = salida de stock
-- ===========================================================================

-- ASIGNACION_ARREGLO lineas (mes actual)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id) VALUES
  ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001', 2, 2, 6500,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000004', 1, 1, 9800,-1, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000008', 1, 1,68000,-1, 'b1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000004'),
  ('91000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000002', 2, 2, 4200,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000005', 1, 1, 5200,-1, 'b1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003');

-- ASIGNACION_ARREGLO lineas (mes -1, Abril)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id) VALUES
  ('91000000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000011','70000000-0000-0000-0000-000000000001', 2, 2, 6500,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000012','70000000-0000-0000-0000-000000000005', 1, 1, 5200,-1, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000013','90000000-0000-0000-0000-000000000013','70000000-0000-0000-0000-000000000002', 3, 3, 4200,-3, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000014','90000000-0000-0000-0000-000000000014','70000000-0000-0000-0000-000000000006', 2, 2, 9800,-2, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001');

-- ASIGNACION_ARREGLO lineas (mes -2, Marzo)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id) VALUES
  ('91000000-0000-0000-0000-000000000015','90000000-0000-0000-0000-000000000015','70000000-0000-0000-0000-000000000001', 2, 2, 6500,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000016','90000000-0000-0000-0000-000000000016','70000000-0000-0000-0000-000000000004', 1, 1, 5200,-1, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000017','90000000-0000-0000-0000-000000000017','70000000-0000-0000-0000-000000000009', 1, 1, 4300,-1, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004');

-- ASIGNACION_ARREGLO lineas (meses -3, -4, -5)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id) VALUES
  ('91000000-0000-0000-0000-000000000018','90000000-0000-0000-0000-000000000018','70000000-0000-0000-0000-000000000001', 2, 2, 6500,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000019','90000000-0000-0000-0000-000000000019','70000000-0000-0000-0000-000000000004', 1, 1, 5200,-1, 'b1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000020','90000000-0000-0000-0000-000000000020','70000000-0000-0000-0000-000000000001', 1, 1, 6500,-1, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000021','90000000-0000-0000-0000-000000000021','70000000-0000-0000-0000-000000000005', 1, 1, 5200,-1, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000022','90000000-0000-0000-0000-000000000022','70000000-0000-0000-0000-000000000002', 2, 2, 4200,-2, 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000023','90000000-0000-0000-0000-000000000023','70000000-0000-0000-0000-000000000004', 1, 1, 9800,-1, 'b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003');

-- COMPRA lineas (reposición de stock, 6 meses)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad) VALUES
  -- Mayo
  ('91000000-0000-0000-0000-000000000100','90000000-0000-0000-0000-000000000100','70000000-0000-0000-0000-000000000001',30,30,4200, 30),
  ('91000000-0000-0000-0000-000000000101','90000000-0000-0000-0000-000000000101','70000000-0000-0000-0000-000000000005',20,20,3200, 20),
  -- Abril
  ('91000000-0000-0000-0000-000000000102','90000000-0000-0000-0000-000000000102','70000000-0000-0000-0000-000000000001',25,25,4200, 25),
  ('91000000-0000-0000-0000-000000000103','90000000-0000-0000-0000-000000000103','70000000-0000-0000-0000-000000000009',15,15,2600, 15),
  -- Marzo
  ('91000000-0000-0000-0000-000000000104','90000000-0000-0000-0000-000000000104','70000000-0000-0000-0000-000000000004',20,20,3500, 20),
  ('91000000-0000-0000-0000-000000000105','90000000-0000-0000-0000-000000000105','70000000-0000-0000-0000-000000000002',30,30,2500, 30),
  -- Febrero
  ('91000000-0000-0000-0000-000000000106','90000000-0000-0000-0000-000000000106','70000000-0000-0000-0000-000000000001',20,20,4200, 20),
  ('91000000-0000-0000-0000-000000000107','90000000-0000-0000-0000-000000000107','70000000-0000-0000-0000-000000000005',15,15,3200, 15),
  -- Enero
  ('91000000-0000-0000-0000-000000000108','90000000-0000-0000-0000-000000000108','70000000-0000-0000-0000-000000000001',15,15,4200, 15),
  ('91000000-0000-0000-0000-000000000109','90000000-0000-0000-0000-000000000109','70000000-0000-0000-0000-000000000009',10,10,2600, 10),
  -- Diciembre
  ('91000000-0000-0000-0000-000000000110','90000000-0000-0000-0000-000000000110','70000000-0000-0000-0000-000000000001',10,10,4200, 10),
  ('91000000-0000-0000-0000-000000000111','90000000-0000-0000-0000-000000000111','70000000-0000-0000-0000-000000000004',10,10,3500, 10);

-- VENTA lineas (venta directa de repuestos, 6 meses)
INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad) VALUES
  ('91000000-0000-0000-0000-000000000200','90000000-0000-0000-0000-000000000200','70000000-0000-0000-0000-000000000004', 3, 3, 5200,-3),
  ('91000000-0000-0000-0000-000000000201','90000000-0000-0000-0000-000000000201','70000000-0000-0000-0000-000000000005', 2, 2, 5200,-2),
  ('91000000-0000-0000-0000-000000000202','90000000-0000-0000-0000-000000000202','70000000-0000-0000-0000-000000000009', 2, 2, 4300,-2),
  ('91000000-0000-0000-0000-000000000203','90000000-0000-0000-0000-000000000203','70000000-0000-0000-0000-000000000001', 3, 3, 6500,-3),
  ('91000000-0000-0000-0000-000000000204','90000000-0000-0000-0000-000000000204','70000000-0000-0000-0000-000000000004', 2, 2, 5200,-2),
  ('91000000-0000-0000-0000-000000000205','90000000-0000-0000-0000-000000000205','70000000-0000-0000-0000-000000000008', 1, 1, 2100,-1);

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

-- Pagos de arreglos: la migración de pagos parciales recalcula esta_pago desde
-- total_cobrado. El seed deja un caso parcial, dos pendientes y el resto cobrado.
-- Va después de vincular los repuestos: recién ahí precio_final incluye las
-- líneas, y si no los arreglos con repuestos quedarían cobrados parcialmente.
UPDATE public.arreglos
SET total_cobrado = CASE id
  WHEN '80000000-0000-0000-0000-000000000007' THEN 50000
  WHEN '80000000-0000-0000-0000-000000000009' THEN 0
  WHEN '80000000-0000-0000-0000-000000000010' THEN 0
  ELSE precio_final
END
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- Cada cobro tiene una operación, su movimiento de cuenta y el vínculo al
-- arreglo. Los IDs se derivan del arreglo y son UUID v4 válidos y estables.
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha)
SELECT
  ('f0000000-0000-4000-8000-' || right(a.id::text, 12))::uuid,
  a.tenant_id,
  'MOVIMIENTO_CUENTA',
  NULL,
  a.fecha + interval '1 day'
FROM public.arreglos AS a
WHERE a.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND a.total_cobrado > 0;

INSERT INTO public.operaciones_movimiento_cuenta (
  operacion_id, tenant_id, subtipo, cuenta_id, importe, descripcion, created_by, created_at
)
SELECT
  ('f0000000-0000-4000-8000-' || right(a.id::text, 12))::uuid,
  a.tenant_id,
  'INGRESO',
  CASE WHEN right(a.id::text, 1)::integer % 2 = 0
    THEN 'c0000000-0000-4000-8000-000000000001'::uuid
    ELSE 'c0000000-0000-4000-8000-000000000002'::uuid
  END,
  a.total_cobrado,
  'Cobro de arreglo: ' || a.descripcion,
  '7ff568f8-4d46-463b-969c-9e68157fa769'::uuid,
  a.fecha + interval '1 day'
FROM public.arreglos AS a
WHERE a.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND a.total_cobrado > 0;

INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
SELECT
  ('f0000000-0000-4000-8000-' || right(a.id::text, 12))::uuid,
  a.id,
  a.tenant_id
FROM public.arreglos AS a
WHERE a.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND a.total_cobrado > 0;

-- Turnos (10)
INSERT INTO public.turnos (id, titulo, fecha, hora, duracion, vehiculo_id, cliente_id, tenant_id, taller_id, tipo, estado, descripcion, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001','Service programado',current_date-3,'09:00',60,'40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Service',   'finalizado','Service programado',now()-interval '4 days',now()-interval '3 days'),
  ('a0000000-0000-0000-0000-000000000002','Revisión de frenos',current_date-2,'10:30',45,'40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Frenos',    'finalizado','Revisión de frenos', now()-interval '3 days',now()-interval '2 days'),
  ('a0000000-0000-0000-0000-000000000003','Chequeo luces',current_date-1,'12:00',30,'40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Luces',     'finalizado','Chequeo luces',      now()-interval '2 days',now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000004','Diagnóstico general',current_date,  '09:30',60,'40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Diagnóstico','confirmado','Diagnóstico general',now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000005','Cambio aceite',current_date+1,'11:00',45,'40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Aceite',    'pendiente', 'Cambio aceite',      now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000006','Revisión batería',current_date+2,'13:00',60,'40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Batería',   'pendiente', 'Revisión batería',   now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000007','Revisión frenos',current_date+3,'14:00',45,'40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Frenos',    'pendiente', 'Revisión frenos',    now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000008','Alineación',current_date+4,'10:00',30,'40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Alineación','pendiente', 'Alineación',         now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000009','Service rápido',current_date+5,'15:00',60,'40000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Service',   'pendiente', 'Service rápido',     now()-interval '1 day', now()-interval '1 day'),
  ('a0000000-0000-0000-0000-000000000010','Service programado',current_date+6,'09:00',45,'40000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','Service',   'pendiente', 'Service programado', now()-interval '1 day', now()-interval '1 day');

-- ===========================================================================
-- HISTORIA EXTENDIDA PARA EL DASHBOARD
-- Agrega arreglos de los meses -17 a +6 respecto de la fecha del seed (en los
-- meses -5 a 0 completa los de arriba), compras y ventas en los meses nuevos,
-- gastos eventuales en todo el rango y aumentos de sueldo.
-- Así se puede comparar contra el mismo mes del año anterior y el dashboard
-- sigue teniendo datos durante los meses siguientes a crear la base.
--
-- Es determinístico (sin random()): cada reset genera exactamente lo mismo.
-- Los tests de integración resetean con este seed, así que respeta:
--   - Nada en 2020: los tests del dashboard esperan marzo 2020 vacío.
--   - Sin cambios de sueldo ni empleados nuevos en Sucursal Oeste (tests de
--     sueldos por taller).
--   - Los inserts directos en operaciones_lineas no mueven stock: los stocks
--     quedan igual.
--   - detalle_arreglo.cantidad = 1 (lo asume el chequeo de precios del final).
-- Las fechas caen a las 10:00 o más tarde en GMT-3 para no cambiar de día al
-- pasar de UTC.
-- ===========================================================================

-- Supabase CLI envía el seed como un batch con caché de sentencias y puede
-- preparar consultas antes de que existan tablas temporales del mismo batch.
-- El bloque DO las planifica al ejecutarlas, después de crear sus dependencias.
DO $b2car_seed_arreglos$
BEGIN
CREATE TEMP TABLE _seed_meses ON COMMIT DROP AS
SELECT
  m AS offset_mes,
  date_trunc('month', now() + m * interval '1 month') AS inicio,
  extract(month FROM now() + m * interval '1 month')::int AS mes_del_anio,
  -- Ajuste de precios aproximado por inflación: -17 meses ≈ 0,66 y +6 ≈ 1,12
  round(1 + 0.02 * m, 2) AS factor_precio
FROM generate_series(-17, 6) AS m;

-- Tipos de trabajo: mano de obra base y el repuesto que usa en cada taller
-- (Central: stocks 001-003, Oeste: 004-007, Sur: 008-010).
CREATE TEMP TABLE _seed_plantillas (
  n                 int PRIMARY KEY,
  categoria_id      uuid NOT NULL,
  descripcion       text NOT NULL,
  detalle           text NOT NULL,
  mano_obra         numeric NOT NULL,
  stock_central     uuid,
  stock_oeste       uuid,
  stock_sur         uuid,
  cantidad_repuesto int NOT NULL
) ON COMMIT DROP;

INSERT INTO _seed_plantillas VALUES
  (0,'b1000000-0000-0000-0000-000000000001','Service completo', 'Mano de obra service completo',    190000,'70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000010',4),
  (1,'b1000000-0000-0000-0000-000000000002','Revisión frenos',  'Cambio de pastillas de freno',     140000,NULL,                                  '70000000-0000-0000-0000-000000000006',NULL,                                  1),
  (2,'b1000000-0000-0000-0000-000000000003','Diagnóstico',      'Diagnóstico computarizado',         60000,NULL,                                  NULL,                                  NULL,                                  0),
  (3,'b1000000-0000-0000-0000-000000000004','Aceite y filtro',  'Cambio de aceite y filtro',         60000,'70000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000010',1),
  (4,'b1000000-0000-0000-0000-000000000005','Cambio batería',   'Colocación y prueba de batería',    45000,'70000000-0000-0000-0000-000000000003',NULL,                                  '70000000-0000-0000-0000-000000000008',1),
  (5,'b1000000-0000-0000-0000-000000000006','Luces delanteras', 'Regulación y cambio de ópticas',    50000,NULL,                                  '70000000-0000-0000-0000-000000000007',NULL,                                  1),
  (6,'b1000000-0000-0000-0000-000000000007','Alineación',       'Alineación y balanceo',             70000,NULL,                                  NULL,                                  NULL,                                  0),
  (7,'b1000000-0000-0000-0000-000000000008','Suspensión',       'Cambio de amortiguadores',         220000,NULL,                                  NULL,                                  NULL,                                  0),
  (8,'b1000000-0000-0000-0000-000000000009','Motor',            'Ajuste de motor y bujías',         260000,NULL,                                  '70000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000009',4),
  (9,'b1000000-0000-0000-0000-000000000010','Electricidad',     'Revisión del sistema eléctrico',    80000,NULL,                                  NULL,                                  '70000000-0000-0000-0000-000000000008',1);

CREATE TEMP TABLE _seed_arreglos ON COMMIT DROP AS
WITH slots AS (
  SELECT
    me.offset_mes,
    me.inicio,
    me.factor_precio,
    i,
    row_number() OVER (ORDER BY me.offset_mes, i) AS n
  FROM _seed_meses AS me
  -- Arreglos por mes: estacionalidad (enero y julio flojos, marzo y diciembre
  -- fuertes) y crecimiento de un arreglo cada 6 meses. En los meses -5 a 0 se
  -- descuentan los que ya están arriba (4, 5, 6, 7, 8 y 10), con un mínimo de 2.
  CROSS JOIN LATERAL generate_series(1, greatest(2, least(14,
    10 + (ARRAY[-3,-2,2,1,0,0,-2,1,1,2,2,3])[me.mes_del_anio] + floor(me.offset_mes / 6.0)::int
    - coalesce((ARRAY[4,5,6,7,8,10])[me.offset_mes + 6], 0)
  ))) AS i
),
candidatos AS (
  SELECT
    s.*,
    s.inicio
      + (((s.i * 11 + s.offset_mes * 3) % 26 + 26) % 26) * interval '1 day'
      + interval '13 hours' + (s.i % 6) * interval '1 hour' AS fecha,
    ('40000000-0000-0000-0000-' || lpad((((s.i * 7 + s.offset_mes * 3) % 10 + 10) % 10 + 1)::text, 12, '0'))::uuid AS vehiculo_id,
    (ARRAY[1,2,1,3,2])[((s.i + s.offset_mes) % 5 + 5) % 5 + 1] AS taller_n,
    -- Service y aceite son los trabajos más frecuentes.
    (ARRAY[0,0,3,1,2,0,4,6,3,5,1,7,8,0,9,3,6,1])[((s.i * 7 + s.offset_mes * 5) % 18 + 18) % 18 + 1] AS plantilla,
    0.85 + (((s.i * 13 + s.offset_mes * 7) % 31 + 31) % 31) / 100.0 AS variacion
  FROM slots AS s
),
con_empleado AS (
  SELECT
    c.*,
    CASE c.taller_n
      WHEN 1 THEN CASE WHEN c.i % 2 = 0 THEN 'e1000000-0000-0000-0000-000000000002' ELSE 'e1000000-0000-0000-0000-000000000001' END
      WHEN 2 THEN 'e1000000-0000-0000-0000-000000000003'
      ELSE 'e1000000-0000-0000-0000-000000000004'
    END::uuid AS empleado_candidato
  FROM candidatos AS c
),
asignados AS (
  -- Antes de que ingrese el empleado de una sucursal, el trabajo lo hace Juan en Sede Central.
  SELECT
    ce.*,
    CASE WHEN e.fecha_ingreso <= ce.fecha::date
      THEN ('50000000-0000-0000-0000-' || lpad(ce.taller_n::text, 12, '0'))::uuid
      ELSE '50000000-0000-0000-0000-000000000001'::uuid
    END AS taller_id,
    CASE WHEN e.fecha_ingreso <= ce.fecha::date
      THEN ce.empleado_candidato
      ELSE 'e1000000-0000-0000-0000-000000000001'::uuid
    END AS empleado_id
  FROM con_empleado AS ce
  JOIN public.empleados AS e ON e.id = ce.empleado_candidato
)
SELECT
  ('8a000000-0000-4000-8000-' || lpad(a.n::text, 12, '0'))::uuid AS id,
  a.n,
  a.i,
  a.offset_mes,
  a.fecha,
  a.vehiculo_id,
  a.taller_id,
  a.empleado_id,
  p.categoria_id,
  p.descripcion,
  p.detalle,
  round(p.mano_obra * a.factor_precio * a.variacion / 500) * 500 AS mano_obra,
  st.id AS stock_id,
  CASE WHEN st.id IS NULL THEN 0 ELSE p.cantidad_repuesto END AS cantidad_repuesto,
  pr.precio_unitario AS precio_repuesto,
  CASE WHEN a.offset_mes >= 0 AND a.i % 4 = 0 THEN 'EN_PROGRESO' ELSE 'TERMINADO' END::public.estado_arreglo AS estado,
  -- Lo pasado está casi todo cobrado; el mes actual y lo futuro tienen pendientes y parciales.
  CASE
    WHEN a.offset_mes >= 0 AND a.i % 3 = 0 THEN 0
    WHEN a.offset_mes >= 0 AND a.i % 5 = 0 THEN 0.5
    WHEN a.offset_mes < 0 AND a.n % 11 = 0 THEN 0.5
    ELSE 1
  END AS fraccion_cobrada
FROM asignados AS a
JOIN _seed_plantillas AS p ON p.n = a.plantilla
LEFT JOIN public.stocks AS st ON st.id = CASE a.taller_id
  WHEN '50000000-0000-0000-0000-000000000001' THEN p.stock_central
  WHEN '50000000-0000-0000-0000-000000000002' THEN p.stock_oeste
  ELSE p.stock_sur
END
LEFT JOIN public.productos AS pr ON pr.id = st.producto_id;

INSERT INTO public.arreglos (id, vehiculo_id, taller_id, estado, fecha, precio_final, esta_pago, descripcion, tenant_id, created_at, updated_at, observaciones)
SELECT
  id, vehiculo_id, taller_id, estado, fecha,
  mano_obra + cantidad_repuesto * coalesce(precio_repuesto, 0),
  false, descripcion, '11111111-1111-1111-1111-111111111111',
  fecha, fecha + interval '1 day', detalle
FROM _seed_arreglos;

INSERT INTO public.detalle_arreglo (id, tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada, categoria_arreglo_id, empleado_id)
SELECT
  ('da000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '11111111-1111-1111-1111-111111111111', id, detalle, 1, mano_obra, categoria_id, empleado_id
FROM _seed_arreglos;

-- Repuestos usados: una ASIGNACION_ARREGLO por arreglo, con la misma fecha.
INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha)
SELECT ('9a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '11111111-1111-1111-1111-111111111111', 'ASIGNACION_ARREGLO', taller_id, fecha
FROM _seed_arreglos
WHERE cantidad_repuesto > 0;

INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id)
SELECT
  ('9b000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('9a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  stock_id, cantidad_repuesto, precio_repuesto, -cantidad_repuesto, categoria_id, empleado_id
FROM _seed_arreglos
WHERE cantidad_repuesto > 0;

INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
SELECT ('9a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, id
FROM _seed_arreglos
WHERE cantidad_repuesto > 0;

-- Cobros: se calculan sobre el precio final ya recalculado con los repuestos.
UPDATE public.arreglos AS a
SET total_cobrado = CASE s.fraccion_cobrada
  WHEN 1 THEN a.precio_final
  WHEN 0 THEN 0
  ELSE floor(a.precio_final * s.fraccion_cobrada / 100) * 100
END
FROM _seed_arreglos AS s
WHERE a.id = s.id;

INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha)
SELECT ('fa000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid, a.tenant_id, 'MOVIMIENTO_CUENTA', NULL, a.fecha + interval '1 day'
FROM public.arreglos AS a
JOIN _seed_arreglos AS s ON s.id = a.id
WHERE a.total_cobrado > 0;

INSERT INTO public.operaciones_movimiento_cuenta (operacion_id, tenant_id, subtipo, cuenta_id, importe, descripcion, created_by, created_at)
SELECT
  ('fa000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
  a.tenant_id,
  'INGRESO',
  CASE WHEN s.n % 2 = 0 THEN 'c0000000-0000-4000-8000-000000000001' ELSE 'c0000000-0000-4000-8000-000000000002' END::uuid,
  a.total_cobrado,
  'Cobro de arreglo: ' || a.descripcion,
  '7ff568f8-4d46-463b-969c-9e68157fa769'::uuid,
  a.fecha + interval '1 day'
FROM public.arreglos AS a
JOIN _seed_arreglos AS s ON s.id = a.id
WHERE a.total_cobrado > 0;

INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
SELECT ('fa000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid, a.id, a.tenant_id
FROM public.arreglos AS a
JOIN _seed_arreglos AS s ON s.id = a.id
WHERE a.total_cobrado > 0;

-- Compras de reposición (2 o 3 por mes) y ventas de mostrador (1 a 3 por mes)
-- en los meses generados. Las cantidades no se descuentan del stock.
CREATE TEMP TABLE _seed_stock_ops ON COMMIT DROP AS
WITH compras AS (
  SELECT me.offset_mes, me.inicio, k, 'COMPRA'::text AS tipo
  FROM _seed_meses AS me
  CROSS JOIN LATERAL generate_series(1, 2 + (me.offset_mes % 2 + 2) % 2) AS k
  WHERE me.offset_mes NOT BETWEEN -5 AND 0
),
ventas AS (
  SELECT me.offset_mes, me.inicio, k, 'VENTA'::text AS tipo
  FROM _seed_meses AS me
  CROSS JOIN LATERAL generate_series(1, 1 + (me.offset_mes % 3 + 3) % 3) AS k
  WHERE me.offset_mes NOT BETWEEN -5 AND 0
),
todas AS (
  SELECT *, row_number() OVER (ORDER BY tipo, offset_mes, k) AS n
  FROM (SELECT * FROM compras UNION ALL SELECT * FROM ventas) AS u
)
SELECT
  t.n,
  t.tipo,
  t.inicio
    + (CASE WHEN t.tipo = 'COMPRA' THEN 2 + (t.k - 1) * 9 ELSE 6 + (t.k - 1) * 8 END) * interval '1 day'
    + interval '15 hours' AS fecha,
  st.id AS stock_id,
  st.taller_id,
  CASE
    WHEN t.tipo = 'VENTA' THEN 1 + (t.n % 4)::int
    WHEN pr.costo_unitario > 20000 THEN 2 + (t.n % 3)::int
    ELSE 10 + ((t.n * 7) % 21)::int
  END AS cantidad,
  CASE WHEN t.tipo = 'COMPRA' THEN pr.costo_unitario ELSE pr.precio_unitario END AS monto_unitario
FROM todas AS t
JOIN public.stocks AS st ON st.id = ('70000000-0000-0000-0000-' || lpad(
  (ARRAY[1,4,10,2,6,9,5,1,4,3,7,8])[(((t.n * 5 + t.offset_mes) % 12 + 12) % 12 + 1)::int]::text, 12, '0'))::uuid
JOIN public.productos AS pr ON pr.id = st.producto_id;

INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha)
SELECT
  ((CASE WHEN tipo = 'COMPRA' THEN '9c' ELSE '9e' END) || '000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '11111111-1111-1111-1111-111111111111', tipo::public.tipo_operacion, taller_id, fecha
FROM _seed_stock_ops;

INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad)
SELECT
  ((CASE WHEN tipo = 'COMPRA' THEN '9d' ELSE '9f' END) || '000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ((CASE WHEN tipo = 'COMPRA' THEN '9c' ELSE '9e' END) || '000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  stock_id, cantidad, monto_unitario,
  CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE -cantidad END
FROM _seed_stock_ops;

-- Gastos eventuales en todo el rango (también en los meses -5 a 0): alquiler y
-- servicios todos los meses, y otros gastos cada 2, 3 o 4 meses.
CREATE TEMP TABLE _seed_gastos ON COMMIT DROP AS
SELECT
  row_number() OVER (ORDER BY me.offset_mes, g.orden) AS n,
  me.inicio + g.dia * interval '1 day' + interval '14 hours' AS fecha,
  g.categoria,
  g.descripcion,
  CASE
    WHEN g.categoria = 'ALQUILER' THEN round(g.importe * me.factor_precio / 1000) * 1000
    ELSE round(g.importe * me.factor_precio * (0.9 + ((me.offset_mes * 7 + g.orden * 3) % 21 + 21) % 21 / 100.0) / 500) * 500
  END AS importe
FROM _seed_meses AS me
JOIN (VALUES
  (1, 4,  'ALQUILER',                  'Alquiler del local',          180000, 1),
  (2, 9,  'SERVICIOS',                 'Luz, gas e internet',          55000, 1),
  (3, 14, 'IMPUESTOS',                 'Tasas municipales',            30000, 2),
  (4, 18, 'MANTENIMIENTO',             'Mantenimiento de elevadores',  40000, 3),
  (5, 22, 'HERRAMIENTAS_EQUIPAMIENTO', 'Compra de herramientas',       85000, 4)
) AS g(orden, dia, categoria, descripcion, importe, cada_meses)
  ON (me.offset_mes % g.cada_meses + g.cada_meses) % g.cada_meses = 0;

INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, fecha)
SELECT ('ea000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '11111111-1111-1111-1111-111111111111', 'MOVIMIENTO_CUENTA', NULL, fecha
FROM _seed_gastos;

INSERT INTO public.operaciones_movimiento_cuenta (operacion_id, tenant_id, subtipo, cuenta_id, importe, categoria_gasto, descripcion, created_by, created_at)
SELECT
  ('ea000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '11111111-1111-1111-1111-111111111111',
  'GASTO',
  CASE WHEN n % 2 = 0 THEN 'c0000000-0000-4000-8000-000000000001' ELSE 'c0000000-0000-4000-8000-000000000002' END::uuid,
  -importe,
  categoria,
  descripcion,
  '7ff568f8-4d46-463b-969c-9e68157fa769'::uuid,
  fecha
FROM _seed_gastos;

END;
$b2car_seed_arreglos$;

-- Aumentos de sueldo (hace 10 meses, hace 4 meses y dentro de 2) para Sede
-- Central y Sucursal Sur. Sucursal Oeste queda sin cambios a propósito.
INSERT INTO public.empleado_salarios (empleado_id, tenant_id, taller_id, salario, vigente_desde)
SELECT e.id, e.tenant_id, e.taller_id, round(e.salario * r.factor / 1000) * 1000, date_trunc('month', now() + r.offset_mes * interval '1 month')::date
FROM public.empleados AS e
CROSS JOIN (VALUES (-10, 1.12), (-4, 1.25), (2, 1.35)) AS r(offset_mes, factor)
WHERE e.id IN (
  'e1000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000004'
);

-- El salario de la ficha es el vigente hoy.
UPDATE public.empleados AS e
SET salario = vigente.salario
FROM (
  SELECT DISTINCT ON (es.empleado_id) es.empleado_id, es.salario
  FROM public.empleado_salarios AS es
  WHERE es.vigente_desde <= current_date
  ORDER BY es.empleado_id, es.vigente_desde DESC
) AS vigente
WHERE vigente.empleado_id = e.id
  AND e.salario <> vigente.salario;

-- Sincronizar listas derivadas materializadas (tipos y empleados en arreglos)
DO $$
DECLARE
  v_arreglo record;
  v_invalid_accounts integer;
  v_account_balance_mismatches integer;
  v_payment_mismatches integer;
  v_price_mismatches integer;
BEGIN
  FOR v_arreglo IN SELECT id FROM public.arreglos LOOP
    PERFORM public._sync_arreglo_derivados(v_arreglo.id);
  END LOOP;

  -- Las rutas aceptan UUIDs canónicos; las cuentas del seed deben ser navegables.
  SELECT count(*) INTO v_invalid_accounts
  FROM public.cuentas_financieras
  WHERE id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_invalid_accounts > 0 THEN
    RAISE EXCEPTION 'Seed inconsistente: % cuenta(s) con UUID no navegable', v_invalid_accounts;
  END IF;

  -- El saldo materializado de cada cuenta debe ser exactamente su ledger.
  SELECT count(*) INTO v_account_balance_mismatches
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.movimientos_financieros AS m ON m.cuenta_financiera_id = c.id
  GROUP BY c.id, c.saldo
  HAVING c.saldo <> COALESCE(SUM(m.importe), 0);
  IF v_account_balance_mismatches > 0 THEN
    RAISE EXCEPTION 'Seed inconsistente: % saldo(s) de cuenta no coincide(n) con el ledger', v_account_balance_mismatches;
  END IF;

  -- Cada total cobrado tiene el mismo respaldo en movimientos de ingreso.
  SELECT count(*) INTO v_payment_mismatches
  FROM public.arreglos AS a
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.arreglo_id = a.id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = oca.operacion_id
  GROUP BY a.id, a.total_cobrado
  HAVING COALESCE(SUM(omc.importe) FILTER (WHERE omc.subtipo = 'INGRESO'), 0) <> a.total_cobrado;
  IF v_payment_mismatches > 0 THEN
    RAISE EXCEPTION 'Seed inconsistente: % arreglo(s) no coincide(n) con sus cobros', v_payment_mismatches;
  END IF;

  -- Cuando hay líneas de trabajo/repuestos, su total debe explicar el precio final.
  WITH totales AS (
    SELECT
      a.id,
      a.precio_final,
      COALESCE((SELECT SUM(CASE WHEN d.horas_facturadas IS NULL THEN d.cantidad * d.precio_hora_facturada ELSE d.horas_facturadas * d.precio_hora_facturada END) FROM public.detalle_arreglo AS d WHERE d.arreglo_id = a.id), 0)
      + COALESCE((
        SELECT SUM(ol.cantidad * ol.monto_unitario)
        FROM public.operaciones_asignacion_arreglo AS oaa
        JOIN public.operaciones_lineas AS ol ON ol.operacion_id = oaa.operacion_id
        WHERE oaa.arreglo_id = a.id
      ), 0) AS total_detallado
    FROM public.arreglos AS a
  )
  SELECT count(*) INTO v_price_mismatches
  FROM totales
  WHERE total_detallado > 0 AND total_detallado <> precio_final;
  IF v_price_mismatches > 0 THEN
    RAISE EXCEPTION 'Seed inconsistente: % arreglo(s) no coincide(n) con sus líneas', v_price_mismatches;
  END IF;
END;
$$;

COMMIT;
