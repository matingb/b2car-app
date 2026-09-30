"""Pruebas unitarias de la migracion desde el sistema externo (B2C-188)."""

from __future__ import annotations

import csv
import importlib.util
import json
import logging
import re
import sys
import tempfile
import unittest
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).with_name("migrar_sistema_externo_tenant.py")
SPEC = importlib.util.spec_from_file_location("migrar_sistema_externo_tenant", SCRIPT_PATH)
assert SPEC and SPEC.loader
migrador = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = migrador
SPEC.loader.exec_module(migrador)

TENANT = "11111111-1111-1111-1111-111111111111"
OTRO_TENANT = "22222222-2222-2222-2222-222222222222"
TALLER = "50000000-0000-0000-0000-000000000001"
OTRO_TALLER = "50000000-0000-0000-0000-000000000002"
CLIENTE = "10000000-0000-0000-0000-000000000007"
OTRO_CLIENTE = "10000000-0000-0000-0000-000000000008"
VEHICULO = "40000000-0000-0000-0000-000000000003"
AHORA = datetime(2026, 9, 30, 12, 0, tzinfo=migrador.ZONA_HORARIA_ORIGEN)

ENCABEZADOS = {
    "clientes.csv": "IdCliente;Razon_Social;NombreFantasia;Nro_CUIT;NroDocumento;Calle;Calle_Nro;Piso;Depto;"
    "localidad;Provincia;IdCodPostal;IdLocalidad;DireccionEmail;Telefono_Movil;Telefono_Fijo;IdMoneda;Observaciones",
    "vehiculos.csv": "Patente;Marca;Modelo;Version;Anio;Color;Cliente;IdCliente;Chasis;Motor",
    "operarios.csv": "IdOperario;Nombre;Domicilio;telefono;Observaciones;ImporteHoraCosto;ImporteHoraVenta",
    "ordenesTrabajo.csv": "IdOT;IdCliente;IdVehiculo;Patente;IdDeposito;IdTipoVehiculo;IdMarca;IdModelo;Version;Anio;"
    "FechaIngreso_S;Kilometraje;SolicitudCliente;ManoObra;Ampliacion;Otros;RefACliente;Total;Facturado;IdFactura;"
    "IdClienteFactura;ImporteaFacturar",
    "tareasEnOT.csv": "IdTareaEnOT;IdOT;DescripcionTarea;GrupoTarea;IdOperario;CantHorasStd;CantHorasVenta;"
    "PrecioHoraVenta;ImporteHorasVenta;CantHorasCosto;PrecioHoraCosto;ImporteCosto;FechaRealizado_S;Kilometraje",
}


def cuit(prefijo: str, numero: str) -> str:
    base = prefijo + numero
    weights = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    check = 11 - sum(int(digit) * weight for digit, weight in zip(base, weights)) % 11
    check = 0 if check == 11 else 9 if check == 10 else check
    return base + str(check)


# --------------------------------------------------------------------------
# Supabase falso en memoria
# --------------------------------------------------------------------------


class FakeResponse:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


def valor_columna(row, column):
    if "->" not in column:
        return row.get(column)
    parts = re.split(r"->>?", column)
    value = row.get(parts[0])
    for part in parts[1:]:
        value = value.get(part) if isinstance(value, dict) else None
    return None if value is None else str(value)


class FakeQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.filters = []
        self.op = "select"
        self.payload = None
        self.row_range = None
        self.row_limit = None

    def select(self, *_columns, **_kwargs):
        self.op = "select"
        return self

    def eq(self, column, value):
        self.filters.append(("eq", column, value))
        self.db.equals.append((self.table_name, column, value))
        return self

    def in_(self, column, values):
        self.filters.append(("in", column, list(values)))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self.row_limit = value
        return self

    def range(self, start, end):
        self.row_range = (start, end)
        return self

    def insert(self, payload, **_kwargs):
        self.op = "insert"
        self.payload = payload if isinstance(payload, list) else [payload]
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        return self.db.execute(self)


CASCADAS = {
    "clientes": (("particulares", "id"), ("empresas", "id"), ("vehiculos", "cliente_id")),
    "vehiculos": (("arreglos", "vehiculo_id"),),
    "arreglos": (("detalle_arreglo", "arreglo_id"),),
}


class FakeSupabase:
    def __init__(self, tablas=None):
        self.tablas = defaultdict(list)
        for table, rows in (tablas or {}).items():
            self.tablas[table] = [dict(row) for row in rows]
        self.equals = []
        self.calls = []
        self.fallar_insert = None
        self.al_insertar = None

    def table(self, table_name):
        return FakeQuery(self, table_name)

    @property
    def escrituras(self):
        return [call for call in self.calls if call[0] in {"insert", "update", "delete"}]

    def inserts(self, table):
        return [row for op, name, payload in self.calls if op == "insert" and name == table for row in payload]

    def _coincide(self, row, filtro):
        tipo, column, value = filtro
        actual = valor_columna(row, column)
        if tipo == "eq":
            return actual == value or (actual is not None and str(actual) == str(value))
        return actual in value

    def _borrar(self, table, predicate):
        borradas = [row for row in self.tablas[table] if predicate(row)]
        self.tablas[table] = [row for row in self.tablas[table] if not predicate(row)]
        for row in borradas:
            for hija, columna in CASCADAS.get(table, ()):
                self._borrar(hija, lambda hijo, row=row, columna=columna: hijo.get(columna) == row["id"])

    def execute(self, query):
        table = query.table_name
        if query.op == "insert":
            self.calls.append(("insert", table, query.payload))
            if self.fallar_insert is not None:
                error = self.fallar_insert(table, query.payload)
                if error is not None:
                    raise error
            rows = [dict(row) for row in query.payload]
            if self.al_insertar is not None:
                self.al_insertar(table, rows)
            self.tablas[table].extend(rows)
            return FakeResponse([])

        def predicate(row):
            return all(self._coincide(row, filtro) for filtro in query.filters)

        if query.op == "update":
            self.calls.append(("update", table, query.payload))
            for row in self.tablas[table]:
                if predicate(row):
                    row.update(query.payload)
            return FakeResponse([])
        if query.op == "delete":
            self.calls.append(("delete", table, [row["id"] for row in self.tablas[table] if predicate(row)]))
            self._borrar(table, predicate)
            return FakeResponse([])

        matching = [dict(row) for row in self.tablas[table] if predicate(row)]
        count = len(matching)
        if query.row_range is not None:
            matching = matching[query.row_range[0] : query.row_range[1] + 1]
        if query.row_limit is not None:
            matching = matching[: query.row_limit]
        return FakeResponse(matching, count)


class ErrorPostgrest(Exception):
    def __init__(self, message, details="Key (dni_cuil)=(12345678) already exists."):
        super().__init__(message)
        self.message = message
        self.code = "23505"
        self.details = details


# --------------------------------------------------------------------------
# Filas de origen
# --------------------------------------------------------------------------


def cliente_row(**overrides):
    values = {
        "line_number": 2,
        "id_cliente": "7",
        "razon_social": "PEREZ JUAN",
        "nro_cuit": None,
        "nro_documento": "12345678",
        "nombre_fantasia": None,
        "calle": "CALLE 35",
        "calle_nro": "3443",
        "piso": "0",
        "depto": None,
        "localidad": "San Andres",
        "provincia": "BUENOS AIRES",
        "email": "juan@example.com",
        "telefono_movil": "1162559377",
        "telefono_fijo": "1147683190",
    }
    values.update(overrides)
    return migrador.ClienteCsv(**values)


def vehiculo_row(**overrides):
    values = {
        "line_number": 2,
        "patente": "HUF763",
        "marca": "FORD",
        "modelo": "FIESTA",
        "version": "1.6",
        "anio": "2010",
        "color": "GRIS",
        "id_cliente": "7",
        "chasis": "abc123",
        "motor": "m1",
    }
    values.update(overrides)
    return migrador.VehiculoCsv(**values)


def operario_row(**overrides):
    values = {
        "line_number": 2,
        "id_operario": "4",
        "nombre": "Juan Carlos Perez",
        "importe_hora_costo": "12000.00",
        "telefono": " 11 5555 1234 ",
        "dni": None,
    }
    values.update(overrides)
    return migrador.OperarioCsv(**values)


def orden_row(**overrides):
    values = {
        "line_number": 2,
        "id_ot": "1",
        "patente": "HUF763",
        "id_vehiculo": "3",
        "id_cliente": "7",
        "fecha_ingreso": "2014-08-22 11:32:53.790",
        "kilometraje": "85000",
        "total": "0.00",
        "id_deposito": "1",
        "id_tipo_vehiculo": "7",
        "id_marca": "10",
        "id_modelo": "277",
        "version": None,
        "anio": "8",
        "facturado": "0",
        "id_factura": "0",
        "id_cliente_factura": "0",
        "importe_a_facturar": "0.00",
    }
    values.update(overrides)
    return migrador.OrdenCsv(**values)


def tarea_row(**overrides):
    values = {
        "line_number": 2,
        "id_tarea": "10",
        "id_ot": "1",
        "descripcion": "Cambio de aceite",
        "cant_horas_venta": "1",
        "precio_hora_venta": "1000",
        "importe_horas_venta": "1000",
        "cant_horas_costo": "1",
        "precio_hora_costo": "600",
        "importe_costo": "600",
        "id_operario": "0",
        "grupo_tarea": None,
        "fecha_realizado": "2014-08-22 12:00:00",
        "kilometraje": None,
    }
    values.update(overrides)
    return migrador.TareaCsv(**values)


def mapa_vehiculos(**extra):
    mapa = migrador.MapaVehiculos(
        por_patente={"HUF763": migrador.VehiculoRef(VEHICULO, CLIENTE, preexistente=False)},
        patentes_csv={"HUF763"},
    )
    mapa.por_patente.update(extra)
    return mapa


def codigos(reporte, nivel=None):
    return [i.codigo for i in reporte.incidencias if nivel is None or i.nivel == nivel]


class BaseTest(unittest.TestCase):
    def setUp(self) -> None:
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        self.tmp = Path(temporary_directory.name)
        logging.disable(logging.CRITICAL)
        self.addCleanup(logging.disable, logging.NOTSET)

    def contexto(self, supabase=None, *, dry_run=False, batch_size=250, estado=None):
        return migrador.Contexto(
            supabase=supabase if supabase is not None else FakeSupabase(),
            tenant_id=TENANT,
            taller_id=TALLER,
            dry_run=dry_run,
            batch_size=batch_size,
            reporte=migrador.Reporte(),
            estado=estado or migrador.EstadoMigracion(self.tmp / "estado.json", TENANT, TALLER, migrador.ORIGEN_MIGRACION),
            ahora=AHORA,
        )

    def procesar(self, ordenes, tareas, *, clientes=None, vehiculos=None, operarios=None, categorias=None, supabase=None, dry_run=True, estado=None):
        ctx = self.contexto(supabase, dry_run=dry_run, estado=estado)
        planes = migrador.procesar_ordenes(
            ctx,
            ordenes,
            tareas,
            clientes if clientes is not None else {"7": CLIENTE},
            vehiculos or mapa_vehiculos(),
            operarios or migrador.MapaOperarios(),
            categorias or {},
        )
        return ctx, planes

    def escribir_csvs(self, directorio: Path, filas: dict[str, list[str]], encabezados=None) -> None:
        directorio.mkdir(parents=True, exist_ok=True)
        for nombre, encabezado in (encabezados or ENCABEZADOS).items():
            (directorio / nombre).write_text(
                "\n".join([encabezado, *filas.get(nombre, [])]) + "\n", encoding="utf-8"
            )


# --------------------------------------------------------------------------
# Lectura y normalizacion
# --------------------------------------------------------------------------


class LecturaTests(BaseTest):
    def test_lee_los_cinco_csv_con_los_encabezados_del_ticket(self) -> None:
        directorio = self.tmp / "csv"
        self.escribir_csvs(
            directorio,
            {
                "clientes.csv": ["007;  PEREZ   JUAN ;NULL;0;12.345.678;Calle;12;0;;San Andres;BA;1;2;j@x.com;;4444;1;obs"],
                "vehiculos.csv": [
                    "2006;MERCEDES BENZ;SPRINTER 311;;2006;BLANCO;HUMBERTO RODRIGUEZ;883;8AC9036617A953696;611981-70-053190",
                    "962KGF;ROUSER;ROUSER;;;AZUL;Francisco ROBLES;139;;",
                ],
                "operarios.csv": ["4;Gustavo;Calle 1;1155;obs;12000.00;20000.00"],
                "ordenesTrabajo.csv": [
                    "1;7;3;HUF763;1;7;10;277;;8;2014-08-22 11:32:53.790;85000;Ruido;;;;;0.00;0;0;0;0.00"
                ],
                "tareasEnOT.csv": ["10;1;Cambio;Service;4;1;1;1000;1000;1;600;600;2014-08-22 12:00:00;85000"],
            },
        )
        # BOM y delimitador coma en uno de los archivos.
        (directorio / "operarios.csv").write_text(
            "﻿IdOperario,Nombre,Domicilio,telefono,Observaciones,ImporteHoraCosto,ImporteHoraVenta\n"
            "4,Gustavo,Calle 1,1155,obs,12000.00,20000.00\n",
            encoding="utf-8",
        )

        datos = migrador.leer_archivos(migrador.localizar_archivos(directorio), "utf-8-sig")

        cliente = datos.clientes[0]
        self.assertEqual(cliente.id_cliente, "007")
        self.assertEqual(cliente.razon_social, "PEREZ JUAN")
        self.assertIsNone(cliente.nombre_fantasia)
        self.assertEqual(cliente.email, "j@x.com")
        self.assertEqual(cliente.telefono_fijo, "4444")
        self.assertEqual(datos.vehiculos[0].id_cliente, "883")
        self.assertEqual(datos.vehiculos[1].anio, None)
        self.assertEqual(datos.operarios[0].importe_hora_costo, "12000.00")
        self.assertEqual(datos.ordenes[0].fecha_ingreso, "2014-08-22 11:32:53.790")
        self.assertEqual(datos.ordenes[0].importe_a_facturar, "0.00")
        self.assertEqual(datos.tareas[0].fecha_realizado, "2014-08-22 12:00:00")
        self.assertEqual(datos.tareas[0].kilometraje, "85000")

    def test_nombres_de_archivo_sin_distinguir_mayusculas(self) -> None:
        directorio = self.tmp / "csv"
        self.escribir_csvs(directorio, {})
        (directorio / "ordenesTrabajo.csv").rename(directorio / "ORDENESTRABAJO.CSV")

        archivos = migrador.localizar_archivos(directorio)

        self.assertEqual(archivos["orden"].name, "ORDENESTRABAJO.CSV")

    def test_archivo_faltante_es_fatal(self) -> None:
        directorio = self.tmp / "csv"
        self.escribir_csvs(directorio, {})
        (directorio / "tareasEnOT.csv").unlink()

        with self.assertRaisesRegex(migrador.ErrorFatal, "tareasEnOT.csv"):
            migrador.localizar_archivos(directorio)

    def test_columna_requerida_faltante_es_fatal(self) -> None:
        directorio = self.tmp / "csv"
        encabezados = dict(ENCABEZADOS)
        encabezados["vehiculos.csv"] = "Patente;Marca;Modelo;Version;Anio;Color;Cliente;Chasis;Motor"
        self.escribir_csvs(directorio, {}, encabezados)

        with self.assertRaisesRegex(migrador.ErrorFatal, "vehiculos.csv.*id_cliente"):
            migrador.leer_archivos(migrador.localizar_archivos(directorio), "utf-8-sig")

    def test_encoding_incorrecto_sugiere_cp1252(self) -> None:
        directorio = self.tmp / "csv"
        self.escribir_csvs(directorio, {})
        (directorio / "clientes.csv").write_bytes(
            (ENCABEZADOS["clientes.csv"] + "\n1;MU\xd1OZ;;;;;;;;;;;;;;;;\n").encode("cp1252")
        )

        with self.assertRaisesRegex(migrador.ErrorFatal, "--encoding cp1252"):
            migrador.leer_archivos(migrador.localizar_archivos(directorio), "utf-8-sig")

    def test_conserva_la_linea_fisica_con_campos_multilinea(self) -> None:
        path = self.tmp / "ordenesTrabajo.csv"
        path.write_text(
            ENCABEZADOS["ordenesTrabajo.csv"] + "\n"
            '1;7;3;HUF763;1;7;10;277;;8;2014-08-22;1;"linea 1\nlinea 2";;;;;0;0;0;0;0\n'
            "\n"
            "2;7;3;HUF763;1;7;10;277;;8;2014-08-22;1;;;;;;0;0;0;0;0\n",
            encoding="utf-8",
        )

        rows = migrador.read_csv_rows(path, migrador.ORDENES_REQUERIDAS, migrador.ORDENES_OPCIONALES, "utf-8")

        self.assertEqual([line for line, _ in rows], [2, 5])
        self.assertEqual(rows[0][1]["solicitud_cliente"], "linea 1 linea 2")

    def test_normalizaciones(self) -> None:
        casos_id = {"007": "7", "0": None, "NULL": None, "\\N": None, " 7.0 ": "7", "A1": "A1", "": None}
        for valor, esperado in casos_id.items():
            with self.subTest(valor=valor):
                self.assertEqual(migrador.normalizar_id_origen(valor), esperado)
        self.assertEqual(migrador.parse_decimal("50500.00"), Decimal("50500.00"))
        self.assertEqual(migrador.parse_decimal("1,5"), Decimal("1.5"))
        self.assertEqual(migrador.parse_decimal("1.234,56"), Decimal("1234.56"))
        self.assertEqual(migrador.parse_decimal("1,234.56"), Decimal("1234.56"))
        self.assertIsNone(migrador.parse_decimal("null"))
        for invalido in ("abc", "NaN", "Infinity"):
            with self.subTest(invalido=invalido), self.assertRaises(ValueError):
                migrador.parse_decimal(invalido)
        self.assertEqual(migrador.parse_entero_positivo("123.456"), 123456)
        self.assertIsNone(migrador.parse_entero_positivo("0"))
        self.assertIsNone(migrador.parse_entero_positivo("3000000000"))

    def test_fechas_de_origen(self) -> None:
        fecha = migrador.parse_fecha_origen("2014-08-22 11:32:53.790", AHORA)
        self.assertEqual(fecha.isoformat(), "2014-08-22T11:32:53.790000-03:00")
        self.assertEqual(migrador.parse_fecha_origen("22/08/2014", AHORA).isoformat(), "2014-08-22T00:00:00-03:00")
        self.assertIsNone(migrador.parse_fecha_origen(None, AHORA))
        for invalida in ("1900-01-01 00:00:00", "1899-12-30", "2030-01-01", "ayer"):
            with self.subTest(invalida=invalida), self.assertRaises(ValueError):
                migrador.parse_fecha_origen(invalida, AHORA)


# --------------------------------------------------------------------------
# Clientes
# --------------------------------------------------------------------------


class ClientesTests(BaseTest):
    def test_clasificacion_por_cuit_cuil_y_dni(self) -> None:
        casos = [
            ("empresa 30", {"nro_cuit": cuit("30", "71234567")}, "empresa", cuit("30", "71234567")),
            ("empresa 33", {"nro_cuit": "33-50549957-9"}, "empresa", "33505499579"),
            ("empresa 34", {"nro_cuit": cuit("34", "12345678")}, "empresa", cuit("34", "12345678")),
            ("cuil 20", {"nro_cuit": "20-12345678-6"}, "particular", "20123456786"),
            ("dni", {"nro_cuit": "0", "nro_documento": "12.345.678"}, "particular", "12345678"),
            ("cuil en documento", {"nro_documento": cuit("27", "23456789")}, "particular", cuit("27", "23456789")),
            ("sin documento", {"nro_documento": "0"}, "particular", None),
        ]
        for nombre, overrides, tipo, identificacion in casos:
            with self.subTest(nombre):
                cliente, avisos = migrador.clasificar_cliente(cliente_row(**overrides))
                self.assertEqual(cliente.tipo_cliente, tipo)
                self.assertEqual(cliente.identificacion, identificacion)
                self.assertEqual(cliente.apellido, "" if tipo == "particular" else None)
                self.assertEqual(avisos, [])

    def test_cuit_con_digito_invalido_se_ignora_con_warning(self) -> None:
        valido = cuit("30", "71234567")
        invalido = valido[:-1] + str((int(valido[-1]) + 1) % 10)

        cliente, avisos = migrador.clasificar_cliente(cliente_row(nro_cuit=invalido, nro_documento="12345678"))

        self.assertEqual((cliente.tipo_cliente, cliente.identificacion), ("particular", "12345678"))
        self.assertEqual([a.codigo for a in avisos], ["CUIT_INVALIDO"])

    def test_nombre_fantasia_email_telefono_y_direccion(self) -> None:
        cliente, avisos = migrador.clasificar_cliente(
            cliente_row(razon_social=None, nombre_fantasia="EL TALLER", email="sin-arroba", telefono_movil=None)
        )

        self.assertEqual(cliente.nombre, "EL TALLER")
        self.assertIsNone(cliente.email)
        self.assertEqual(cliente.telefono, "1147683190")
        self.assertEqual(cliente.direccion, "CALLE 35 3443, San Andres, BUENOS AIRES")
        self.assertEqual([a.codigo for a in avisos], ["CLIENTE_NOMBRE_DESDE_FANTASIA", "EMAIL_INVALIDO"])
        with self.assertRaises(migrador.RegistroInvalido):
            migrador.clasificar_cliente(cliente_row(razon_social=None, nombre_fantasia=None))

    def test_payloads_llevan_tenant_id_y_la_consulta_se_filtra_por_tenant(self) -> None:
        supabase = FakeSupabase()
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_clientes(
            ctx,
            [
                cliente_row(id_cliente="1", nro_cuit="33-50549957-9", nro_documento=None),
                cliente_row(id_cliente="2"),
            ],
        )

        for table in ("clientes", "empresas", "particulares"):
            rows = supabase.inserts(table)
            self.assertTrue(rows, table)
            self.assertTrue(all(row["tenant_id"] == TENANT for row in rows), table)
        self.assertIn(("empresas", "tenant_id", TENANT), supabase.equals)
        self.assertIn(("particulares", "tenant_id", TENANT), supabase.equals)
        self.assertEqual(set(mapa), {"1", "2"})
        self.assertEqual(ctx.reporte.estadisticas["cliente"].creados, 2)

    def test_documento_existente_en_el_tenant_se_reutiliza_sin_modificar(self) -> None:
        supabase = FakeSupabase(
            {
                "particulares": [
                    {"id": OTRO_CLIENTE, "tenant_id": OTRO_TENANT, "dni_cuil": "12345678"},
                    {"id": CLIENTE, "tenant_id": TENANT, "dni_cuil": "12345678"},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_clientes(ctx, [cliente_row()])

        self.assertEqual(mapa, {"7": CLIENTE})
        self.assertEqual(supabase.escrituras, [])
        self.assertEqual(ctx.estado.clientes, {"7": CLIENTE})
        self.assertEqual(ctx.reporte.estadisticas["cliente"].reutilizados, 1)

    def test_existente_ambiguo_y_documento_compartido(self) -> None:
        supabase = FakeSupabase(
            {
                "particulares": [
                    {"id": CLIENTE, "tenant_id": TENANT, "dni_cuil": "11111111"},
                    {"id": OTRO_CLIENTE, "tenant_id": TENANT, "dni_cuil": "11111111"},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_clientes(
            ctx,
            [
                cliente_row(id_cliente="1", nro_documento="11111111"),
                cliente_row(id_cliente="2", line_number=3, nro_documento="22222222"),
                cliente_row(id_cliente="3", line_number=4, nro_documento="22222222"),
            ],
        )

        self.assertNotIn("1", mapa)
        self.assertEqual(mapa["2"], mapa["3"])
        self.assertEqual(len(supabase.inserts("clientes")), 1)
        self.assertEqual(
            codigos(ctx.reporte), ["CLIENTE_DOCUMENTO_COMPARTIDO", "CLIENTE_EXISTENTE_AMBIGUO"][::-1]
        )
        stats = ctx.reporte.estadisticas["cliente"]
        self.assertEqual((stats.creados, stats.reutilizados, stats.fallidos), (1, 1, 1))

    def test_id_duplicado_rechaza_todas_las_filas(self) -> None:
        ctx = self.contexto()

        mapa = migrador.procesar_clientes(ctx, [cliente_row(), cliente_row(line_number=3, nro_documento="23456789")])

        self.assertEqual(mapa, {})
        self.assertEqual(codigos(ctx.reporte), ["CLIENTE_ID_DUPLICADO", "CLIENTE_ID_DUPLICADO"])

    def test_fallo_de_particulares_revierte_clientes_base_y_el_estado(self) -> None:
        supabase = FakeSupabase()
        supabase.fallar_insert = lambda table, _rows: ErrorPostgrest("duplicate key") if table == "particulares" else None
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_clientes(ctx, [cliente_row()])

        self.assertEqual(mapa, {})
        self.assertEqual(supabase.tablas["clientes"], [])
        self.assertEqual(ctx.estado.clientes, {})
        incidencia = ctx.reporte.incidencias[0]
        self.assertEqual(incidencia.codigo, "CLIENTE_INSERCION_FALLIDA")
        self.assertNotIn("12345678", incidencia.motivo)

    def test_escritura_anticipada_del_estado(self) -> None:
        supabase = FakeSupabase()
        ctx = self.contexto(supabase)
        vistos = []

        def espiar(table, rows):
            if table == "clientes":
                vistos.append(json.loads(ctx.estado.path.read_text(encoding="utf-8"))["clientes"])

        supabase.fallar_insert = espiar

        mapa = migrador.procesar_clientes(ctx, [cliente_row()])

        self.assertEqual(vistos, [{"7": mapa["7"]}])


# --------------------------------------------------------------------------
# Vehiculos
# --------------------------------------------------------------------------


class VehiculosTests(BaseTest):
    def test_payload_de_las_filas_de_ejemplo(self) -> None:
        sprinter, avisos_sprinter = migrador.preparar_vehiculo(
            vehiculo_row(
                patente="2006", marca="MERCEDES BENZ", modelo="SPRINTER 311", version=None, anio="2006",
                color="BLANCO", id_cliente="883", chasis="8AC9036617A953696", motor="611981-70-053190",
            ),
            2026,
        )
        rouser, avisos_rouser = migrador.preparar_vehiculo(
            vehiculo_row(
                patente="962KGF", marca="ROUSER", modelo="ROUSER", version=None, anio=None,
                color="AZUL", id_cliente="139", chasis=None, motor=None,
            ),
            2026,
        )

        payload = migrador.vehicle_payload(sprinter, TENANT, VEHICULO, CLIENTE)
        self.assertEqual(payload["modelo"], "SPRINTER 311")
        self.assertEqual(payload["fecha_patente"], "2006")
        self.assertEqual(payload["numero_chasis"], "8AC9036617A953696")
        self.assertEqual(payload["tenant_id"], TENANT)
        self.assertEqual([a.codigo for a in avisos_sprinter], ["VEHICULO_PATENTE_NO_ESTANDAR"])
        self.assertIsNone(rouser.fecha_patente)
        self.assertEqual((rouser.numero_chasis, rouser.numero_motor), ("", ""))
        self.assertEqual(avisos_rouser, [])
        _, avisos = migrador.preparar_vehiculo(vehiculo_row(anio="85"), 2026)
        self.assertEqual([a.codigo for a in avisos], ["VEHICULO_ANIO_INVALIDO"])

    def test_vincula_por_id_cliente_y_rechaza_cliente_faltante(self) -> None:
        supabase = FakeSupabase()
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_vehiculos(
            ctx,
            [vehiculo_row(), vehiculo_row(line_number=3, patente="AB123CD", id_cliente="99"), vehiculo_row(patente=" ")],
            {"7": CLIENTE},
        )

        insert = supabase.inserts("vehiculos")
        self.assertEqual([row["patente"] for row in insert], ["HUF763"])
        self.assertEqual(insert[0]["cliente_id"], CLIENTE)
        self.assertEqual(insert[0]["modelo"], "FIESTA 1.6")
        self.assertEqual(mapa.por_patente["HUF763"].vehiculo_id, insert[0]["id"])
        self.assertEqual(mapa.fallidos, {"AB123CD": "VEHICULO_CLIENTE_NO_RESUELTO"})
        self.assertEqual(codigos(ctx.reporte), ["VEHICULO_SIN_PATENTE", "VEHICULO_CLIENTE_NO_RESUELTO"])
        self.assertIn(("vehiculos", "tenant_id", TENANT), supabase.equals)

    def test_patente_existente_del_mismo_u_otro_cliente(self) -> None:
        supabase = FakeSupabase(
            {
                "vehiculos": [
                    {"id": VEHICULO, "tenant_id": TENANT, "patente": "HUF763", "cliente_id": CLIENTE},
                    {"id": "v-otro", "tenant_id": TENANT, "patente": "AB 123 CD", "cliente_id": OTRO_CLIENTE},
                    {"id": "v-otro-tenant", "tenant_id": OTRO_TENANT, "patente": "AA111AA", "cliente_id": CLIENTE},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_vehiculos(
            ctx,
            [vehiculo_row(), vehiculo_row(line_number=3, patente="AB123CD"), vehiculo_row(line_number=4, patente="AA111AA")],
            {"7": CLIENTE},
        )

        self.assertEqual([row["patente"] for row in supabase.inserts("vehiculos")], ["AA111AA"])
        self.assertEqual(ctx.estado.vehiculos["HUF763"], VEHICULO)
        self.assertEqual(mapa.fallidos, {"AB123CD": "VEHICULO_PATENTE_DE_OTRO_CLIENTE"})
        stats = ctx.reporte.estadisticas["vehiculo"]
        self.assertEqual((stats.creados, stats.reutilizados, stats.fallidos), (1, 1, 1))

    def test_patente_repetida_con_mismo_o_distinto_cliente(self) -> None:
        supabase = FakeSupabase()
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_vehiculos(
            ctx,
            [
                vehiculo_row(line_number=2, color=None),
                vehiculo_row(line_number=3, patente="huf-763", color="ROJO"),
                vehiculo_row(line_number=4, patente="AB123CD", id_cliente="7"),
                vehiculo_row(line_number=5, patente="AB123CD", id_cliente="8"),
            ],
            {"7": CLIENTE, "8": OTRO_CLIENTE},
        )

        insert = supabase.inserts("vehiculos")
        self.assertEqual([(row["patente"], row["color"]) for row in insert], [("HUF763", "ROJO")])
        self.assertEqual(
            codigos(ctx.reporte),
            ["VEHICULO_PATENTE_REPETIDA", "VEHICULO_PATENTE_CONFLICTO", "VEHICULO_PATENTE_CONFLICTO"],
        )
        self.assertEqual(mapa.fallidos, {"AB123CD": "VEHICULO_PATENTE_CONFLICTO"})


# --------------------------------------------------------------------------
# Operarios
# --------------------------------------------------------------------------


class OperariosTests(BaseTest):
    def test_valor_hora_nombre_y_dni_ficticio(self) -> None:
        supabase = FakeSupabase()
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_operarios(
            ctx,
            [operario_row(), operario_row(line_number=3, id_operario="28", nombre="Gustavo", importe_hora_costo="0")],
        )

        juan, gustavo = supabase.inserts("empleados")
        self.assertEqual((juan["nombre"], juan["apellido"], juan["dni"]), ("Juan Carlos", "Perez", "99000004"))
        self.assertEqual(juan["valor_hora"], 12000.0)
        self.assertEqual(juan["telefono"], "11 5555 1234")
        self.assertEqual((juan["tenant_id"], juan["taller_id"]), (TENANT, TALLER))
        self.assertEqual((gustavo["nombre"], gustavo["apellido"], gustavo["dni"]), ("Gustavo", " ", "99000028"))
        self.assertIsNone(gustavo["valor_hora"])
        self.assertEqual(set(mapa.por_id), {"4", "28"})
        self.assertEqual(
            sorted(codigos(ctx.reporte)),
            ["OPERARIO_DNI_FICTICIO", "OPERARIO_DNI_FICTICIO", "OPERARIO_SIN_APELLIDO"],
        )
        self.assertEqual(ctx.reporte.contadores["operarios_dni_ficticio"], 2)
        self.assertEqual(ctx.reporte.contadores["operarios_sin_apellido"], 1)
        self.assertIn(("empleados", "taller_id", TALLER), supabase.equals)

    def test_dni_ficticio_es_deterministico(self) -> None:
        self.assertEqual(migrador.dni_ficticio_derivado("4"), "99000004")
        self.assertEqual(migrador.dni_ficticio_derivado("28"), "99000028")
        self.assertEqual(migrador.dni_ficticio_derivado("999999"), "99999999")
        self.assertIsNone(migrador.dni_ficticio_derivado("1000000"))
        self.assertIsNone(migrador.dni_ficticio_derivado("A1"))

    def test_dni_ficticio_no_derivable_usa_el_primer_libre(self) -> None:
        supabase = FakeSupabase(
            {"empleados": [{"id": "e1", "tenant_id": TENANT, "taller_id": TALLER, "nombre": "Otro", "apellido": "X", "dni": "99000000"}]}
        )
        ctx = self.contexto(supabase)

        migrador.procesar_operarios(
            ctx,
            [
                operario_row(id_operario="B2", nombre="Ana Diaz"),
                operario_row(line_number=3, id_operario="1000000", nombre="Luis Gomez"),
                operario_row(line_number=4, id_operario="A1", nombre="Eva Ruiz"),
            ],
        )

        dnis = {row["nombre"]: row["dni"] for row in supabase.inserts("empleados")}
        self.assertEqual(dnis, {"Luis": "99000001", "Eva": "99000002", "Ana": "99000003"})
        self.assertEqual(codigos(ctx.reporte).count("OPERARIO_DNI_FICTICIO_NO_DERIVABLE"), 3)

    def test_columna_de_dni_valida_o_invalida(self) -> None:
        valido, avisos_validos = migrador.preparar_operario(operario_row(dni="30.123.456"), "4")
        invalido, avisos_invalidos = migrador.preparar_operario(operario_row(dni="123"), "4")

        self.assertEqual((valido.dni, valido.dni_ficticio), ("30123456", False))
        self.assertEqual(avisos_validos, [])
        self.assertEqual((invalido.dni, invalido.dni_ficticio), ("99000004", True))
        self.assertIn("no es valido", avisos_invalidos[0].motivo)

    def test_reutiliza_por_dni_o_por_nombre_sin_modificar_al_empleado(self) -> None:
        supabase = FakeSupabase(
            {
                "empleados": [
                    {"id": "e-dni", "tenant_id": TENANT, "taller_id": TALLER, "nombre": "J", "apellido": "P", "dni": "99000004"},
                    {"id": "e-nombre", "tenant_id": TENANT, "taller_id": TALLER, "nombre": "Gústavo", "apellido": " ", "dni": "30111222"},
                    {"id": "e-otro-taller", "tenant_id": TENANT, "taller_id": OTRO_TALLER, "nombre": "Pedro", "apellido": "Paz", "dni": "99000009"},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_operarios(
            ctx,
            [
                operario_row(),
                operario_row(line_number=3, id_operario="5", nombre="Gustavo"),
                operario_row(line_number=4, id_operario="9", nombre="Pedro Paz"),
            ],
        )

        self.assertEqual(mapa.por_id["4"], "e-dni")
        self.assertEqual(mapa.por_id["5"], "e-nombre")
        self.assertNotEqual(mapa.por_id["9"], "e-otro-taller")
        self.assertEqual([row["dni"] for row in supabase.inserts("empleados")], ["99000009"])
        self.assertFalse([call for call in supabase.calls if call[0] == "update"])
        self.assertIn("OPERARIO_REUTILIZADO_POR_NOMBRE", codigos(ctx.reporte))

    def test_operario_ambiguo(self) -> None:
        supabase = FakeSupabase(
            {
                "empleados": [
                    {"id": "e1", "tenant_id": TENANT, "taller_id": TALLER, "nombre": "Juan Carlos", "apellido": "Perez", "dni": "1"},
                    {"id": "e2", "tenant_id": TENANT, "taller_id": TALLER, "nombre": "Juan Carlos", "apellido": "Perez", "dni": "2"},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_operarios(ctx, [operario_row()])

        self.assertEqual(mapa.por_id, {})
        self.assertEqual(mapa.ambiguos, {"4"})
        self.assertEqual(codigos(ctx.reporte), ["OPERARIO_AMBIGUO"])


# --------------------------------------------------------------------------
# Categorias
# --------------------------------------------------------------------------


class CategoriasTests(BaseTest):
    def test_grupos_se_unifican_y_se_reutilizan_las_del_tenant(self) -> None:
        supabase = FakeSupabase(
            {
                "categorias_arreglo": [
                    {"id": "c-service", "tenant_id": TENANT, "nombre": "Service"},
                    {"id": "c-otro-tenant", "tenant_id": OTRO_TENANT, "nombre": "Frenos"},
                ]
            }
        )
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_categorias(
            ctx,
            [
                tarea_row(grupo_tarea="SERVICE"),
                tarea_row(grupo_tarea="Frénos"),
                tarea_row(grupo_tarea="frenos"),
                tarea_row(grupo_tarea=None),
            ],
        )

        (insert,) = supabase.inserts("categorias_arreglo")
        self.assertEqual((insert["nombre"], insert["tenant_id"]), ("Frénos", TENANT))
        self.assertEqual(mapa, {"service": "c-service", "frenos": insert["id"]})
        stats = ctx.reporte.estadisticas["categoria"]
        self.assertEqual((stats.leidos, stats.creados, stats.reutilizados), (2, 1, 1))
        self.assertEqual(ctx.reporte.contadores["categorias_creadas"], 1)

    def test_conflicto_con_el_indice_unico_relee_y_reutiliza(self) -> None:
        supabase = FakeSupabase()

        def insercion_concurrente(table, _rows):
            if table == "categorias_arreglo":
                supabase.tablas[table].append({"id": "c-concurrente", "tenant_id": TENANT, "nombre": "Frenos"})
                return ErrorPostgrest("duplicate key value violates unique constraint")
            return None

        supabase.fallar_insert = insercion_concurrente
        ctx = self.contexto(supabase)

        mapa = migrador.procesar_categorias(ctx, [tarea_row(grupo_tarea="Frenos")])

        self.assertEqual(mapa, {"frenos": "c-concurrente"})
        self.assertEqual(ctx.reporte.cantidad_errores, 0)


# --------------------------------------------------------------------------
# Importes
# --------------------------------------------------------------------------


class ImportesTests(BaseTest):
    def test_reglas_de_venta_y_costo(self) -> None:
        D = Decimal
        casos = [
            # nombre, overrides, (horas, precio, horas_trab, valor_hora), codigos
            ("importe manda", {"cant_horas_venta": "2", "precio_hora_venta": "1000", "importe_horas_venta": "2500"},
             (D("2"), D("1250.00"), D("1"), D("600.00")), ["TAREA_PRECIO_E_IMPORTE_DIFIEREN"]),
            ("importe con 0 horas", {"cant_horas_venta": "0", "precio_hora_venta": "0", "importe_horas_venta": "3000"},
             (D("1"), D("3000.00"), D("1"), D("600.00")), []),
            ("precio por horas", {"cant_horas_venta": "1.5", "precio_hora_venta": "1000", "importe_horas_venta": "0"},
             (D("1.5"), D("1000.00"), D("1"), D("600.00")), []),
            ("todo en 0", {"cant_horas_venta": "0", "precio_hora_venta": "0", "importe_horas_venta": "0"},
             (D("0"), D("0"), D("1"), D("600.00")), ["TAREA_SIN_IMPORTE_VENTA"]),
            ("horas redondeadas", {"cant_horas_venta": "1.234", "importe_horas_venta": "1000", "precio_hora_venta": None},
             (D("1.23"), D("813.01"), D("1"), D("600.00")), ["TAREA_HORAS_REDONDEADAS"]),
            ("importe de costo manda", {"cant_horas_costo": "3", "precio_hora_costo": "250", "importe_costo": "900"},
             (D("1"), D("1000.00"), D("3"), D("300.00")), []),
            ("importe de costo sin horas", {"cant_horas_costo": "0", "importe_costo": "900"},
             (D("1"), D("1000.00"), D("1"), D("900.00")), ["TAREA_COSTO_SIN_HORAS"]),
            ("precio de costo", {"cant_horas_costo": "2", "precio_hora_costo": "500", "importe_costo": "0"},
             (D("1"), D("1000.00"), D("2"), D("500.00")), []),
            ("costo desconocido", {"cant_horas_costo": "0", "precio_hora_costo": "0", "importe_costo": "NULL"},
             (D("1"), D("1000.00"), D("0"), None), []),
        ]
        for nombre, overrides, esperado, esperados_codigos in casos:
            with self.subTest(nombre):
                valores, avisos = migrador.calcular_importes_tarea(tarea_row(**overrides))
                self.assertEqual(
                    (valores.horas_facturadas, valores.precio_hora_facturada, valores.horas_trabajadas, valores.valor_hora_empleado),
                    esperado,
                )
                self.assertEqual([a.codigo for a in avisos], esperados_codigos)

    def test_limites_hacen_fallar_la_tarea(self) -> None:
        for overrides in (
            {"cant_horas_venta": "10000"},
            {"importe_horas_venta": "-5"},
            {"importe_horas_venta": "99999999999", "cant_horas_venta": "1"},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(migrador.RegistroInvalido) as contexto:
                migrador.calcular_importes_tarea(tarea_row(**overrides))
            self.assertEqual(contexto.exception.codigo, "TAREA_VALOR_FUERA_DE_RANGO")

    def test_total_de_la_ot(self) -> None:
        D = Decimal
        tareas = [
            migrador.ValoresTarea(D("1.5"), D("1000.00"), D("1"), None),
            migrador.ValoresTarea(D("1"), D("333.33"), D("1"), None),
        ]  # suma 1833.33
        casos = [
            ("mayor", D("2000"), D("166.67"), D("2000.00"), None),
            ("menor", D("1500"), None, D("1833.33"), "OT_TOTAL_MENOR_QUE_TAREAS"),
            ("igual", D("1833.33"), None, D("1833.33"), None),
            ("dentro de la tolerancia", D("1833.80"), None, D("1833.33"), None),
            ("sin total", None, None, D("1833.33"), None),
        ]
        for nombre, total, diferencia, esperado, codigo in casos:
            with self.subTest(nombre):
                resultado = migrador.planificar_total(tareas, total)
                self.assertEqual(resultado[0], diferencia)
                self.assertEqual(resultado[1], esperado)
                self.assertEqual(resultado[2].codigo if resultado[2] else None, codigo)
        self.assertEqual(migrador.planificar_total([], D("1000")), (D("1000.00"), D("1000.00"), None))
        self.assertEqual(migrador.planificar_total([], None), (None, D("0.00"), None))

    def test_precio_sin_iva(self) -> None:
        self.assertEqual(migrador.calcular_precio_sin_iva(Decimal("1210.00")), Decimal("1000.00"))
        self.assertEqual(migrador.calcular_precio_sin_iva(Decimal("100.00")), Decimal("82.64"))


# --------------------------------------------------------------------------
# Ordenes de trabajo
# --------------------------------------------------------------------------


class OrdenesTests(BaseTest):
    def test_ot_completa_con_payload_extra_data_y_detalles(self) -> None:
        operarios = migrador.MapaOperarios(por_id={"4": "e-4"})
        ctx, planes = self.procesar(
            [
                orden_row(
                    total="2500.00", solicitud_cliente="Ruido en el motor", mano_obra="Revisar", ref_a_cliente="R-1",
                )
            ],
            [
                tarea_row(id_tarea="11", descripcion="Segunda", fecha_realizado="2014-08-23 10:00:00", id_operario="4", grupo_tarea="Frenos"),
                tarea_row(id_tarea="10", fecha_realizado="2014-08-23 10:00:00", id_operario="99"),
            ],
            operarios=operarios,
            categorias={"frenos": "c-frenos"},
        )

        (plan,) = planes
        payload = migrador.arreglo_payload(plan, TENANT, TALLER)
        self.assertEqual(payload["estado"], "TERMINADO")
        self.assertFalse(payload["es_facturable"])
        self.assertEqual((payload["tenant_id"], payload["taller_id"]), (TENANT, TALLER))
        self.assertEqual(payload["fecha"], "2014-08-22T11:32:53.790000-03:00")
        self.assertEqual(payload["kilometraje_leido"], 85000)
        self.assertIsNone(payload["combustible_leido"])
        self.assertEqual(payload["precio_final"], 2500.0)
        self.assertEqual(payload["total_cobrado"], payload["precio_final"])
        self.assertEqual(payload["precio_sin_iva"], 2066.12)
        self.assertEqual(payload["descripcion"], "Cambio de aceite | Segunda")
        self.assertEqual(payload["observaciones"], "Solicitud del cliente: Ruido en el motor\nMano de obra: Revisar\nReferencia: R-1")
        self.assertEqual(
            payload["extra_data"],
            {
                "migracion": {
                    "origen": "sistema-externo",
                    "id_ot": "1",
                    "id_cliente": "7",
                    "id_vehiculo": "3",
                    "patente": "HUF763",
                    "id_deposito": "1",
                    "id_tipo_vehiculo": "7",
                    "id_marca": "10",
                    "id_modelo": "277",
                    "version": None,
                    "anio": "8",
                    "total": "2500.00",
                    "facturado": False,
                    "id_factura": None,
                    "id_cliente_factura": None,
                    "importe_a_facturar": "0.00",
                    "migrado_at": "2026-09-30T12:00:00-03:00",
                }
            },
        )
        detalles = [migrador.detalle_payload(d, TENANT, plan.arreglo_id) for d in plan.detalles]
        self.assertEqual([d["descripcion"] for d in detalles], ["Cambio de aceite", "Segunda", migrador.DESCRIPCION_AJUSTE_TOTAL])
        self.assertEqual(
            [d["created_at"] for d in detalles][:2],
            ["2014-08-23T10:00:00-03:00", "2014-08-23T10:00:00.000001-03:00"],
        )
        self.assertEqual(detalles[0]["empleado_id"], None)
        self.assertEqual(detalles[1]["empleado_id"], "e-4")
        self.assertEqual(detalles[1]["categoria_arreglo_id"], "c-frenos")
        self.assertEqual(
            {k: detalles[2][k] for k in ("cantidad", "horas_facturadas", "horas_trabajadas", "precio_hora_facturada", "valor_hora_empleado", "empleado_id", "categoria_arreglo_id")},
            {"cantidad": 1, "horas_facturadas": 1.0, "horas_trabajadas": 0.0, "precio_hora_facturada": 500.0, "valor_hora_empleado": None, "empleado_id": None, "categoria_arreglo_id": None},
        )
        self.assertGreater(detalles[2]["created_at"], detalles[1]["created_at"])
        self.assertEqual(detalles[0]["valor_hora_empleado"], 600.0)
        self.assertIn("TAREA_OPERARIO_NO_RESUELTO", codigos(ctx.reporte))
        self.assertEqual(ctx.reporte.contadores["tareas_operario_no_resuelto"], 1)
        self.assertEqual(ctx.reporte.contadores["lineas_ajuste_total"], 1)
        self.assertEqual(ctx.reporte.importe_total_migrado, Decimal("2500.00"))
        self.assertEqual(ctx.reporte.depositos, {"1"})

    def test_resolucion_del_vehiculo(self) -> None:
        vehiculos = mapa_vehiculos(
            BCD444=migrador.VehiculoRef("v-seed", CLIENTE, preexistente=True),
        )
        vehiculos.fallidos["AB123CD"] = "VEHICULO_PATENTE_CONFLICTO"
        ctx, planes = self.procesar(
            [
                orden_row(id_ot="1"),
                orden_row(id_ot="2", line_number=3, patente="BCD444", id_vehiculo="5"),
                orden_row(id_ot="3", line_number=4, patente="ZZZ999", id_vehiculo="6"),
                orden_row(id_ot="4", line_number=5, patente="AB123CD", id_vehiculo="7"),
                orden_row(id_ot="5", line_number=6, patente=None, id_vehiculo="3"),
                orden_row(id_ot="6", line_number=7, patente=None, id_vehiculo="8"),
            ],
            [],
            vehiculos=vehiculos,
        )

        self.assertEqual({p.id_ot: p.vehiculo_id for p in planes}, {"1": VEHICULO, "2": "v-seed", "5": VEHICULO})
        errores = {i.id_origen: (i.codigo, i.motivo) for i in ctx.reporte.incidencias if i.nivel == "error"}
        self.assertEqual(errores["3"][0], "OT_VEHICULO_NO_RESUELTO")
        self.assertEqual(errores["4"][0], "OT_VEHICULO_NO_RESUELTO")
        self.assertIn("VEHICULO_PATENTE_CONFLICTO", errores["4"][1])
        self.assertEqual(errores["6"][0], "OT_SIN_PATENTE")
        self.assertIn("OT_VEHICULO_RESUELTO_POR_ID_VEHICULO", codigos(ctx.reporte, "warning"))
        self.assertEqual(ctx.reporte.contadores["ots_vehiculo_preexistente"], 1)
        self.assertEqual(ctx.reporte.contadores["ots_vehiculo_por_id_vehiculo"], 1)

    def test_id_vehiculo_con_varias_patentes_no_es_alternativa(self) -> None:
        vehiculos = mapa_vehiculos(AB123CD=migrador.VehiculoRef("v-2", CLIENTE, preexistente=False))
        ctx, planes = self.procesar(
            [
                orden_row(id_ot="1"),
                orden_row(id_ot="2", line_number=3, patente="AB123CD"),
                orden_row(id_ot="3", line_number=4, patente=None),
            ],
            [],
            vehiculos=vehiculos,
        )

        self.assertEqual({p.id_ot for p in planes}, {"1", "2"})
        # La OT que falla no informa sus warnings; el motivo del error explica la causa.
        self.assertEqual(codigos(ctx.reporte, "warning").count("OT_ID_VEHICULO_CON_VARIAS_PATENTES"), 2)
        self.assertEqual(codigos(ctx.reporte, "error"), ["OT_SIN_PATENTE"])
        self.assertIn("varias patentes", ctx.reporte.incidencias[-1].motivo)

    def test_patente_inexistente_se_resuelve_por_id_vehiculo(self) -> None:
        vehiculos = mapa_vehiculos(AB123CD=migrador.VehiculoRef("v-2", CLIENTE, preexistente=False))
        vehiculos.fallidos["BCD444"] = "VEHICULO_PATENTE_CONFLICTO"
        ctx, planes = self.procesar(
            [
                orden_row(id_ot="1"),
                # Error de tipeo: el mismo IdVehiculo aparece con HUF763 en la OT 1.
                orden_row(id_ot="2", line_number=3, patente="HUF783"),
                orden_row(id_ot="3", line_number=4, patente="BCD444", id_vehiculo="9"),
                orden_row(id_ot="4", line_number=5, patente="BCD4444", id_vehiculo="9"),
                orden_row(id_ot="5", line_number=6, patente="AB123CD", id_vehiculo="10"),
                orden_row(id_ot="6", line_number=7, patente="HUF763", id_vehiculo="10"),
                orden_row(id_ot="7", line_number=8, patente="ZZZ999", id_vehiculo="10"),
            ],
            [],
            vehiculos=vehiculos,
        )

        por_ot = {p.id_ot: p for p in planes}
        self.assertEqual({k: p.vehiculo_id for k, p in por_ot.items()}, {"1": VEHICULO, "2": VEHICULO, "5": "v-2", "6": VEHICULO})
        self.assertIn("patente=HUF763", por_ot["2"].referencias)
        self.assertEqual(por_ot["2"].extra_data["migracion"]["patente"], "HUF783")
        avisos_ot2 = [(i.codigo, i.motivo) for i in ctx.reporte.incidencias if i.id_origen == "2"]
        self.assertEqual([c for c, _ in avisos_ot2], ["OT_VEHICULO_RESUELTO_POR_ID_VEHICULO"])
        self.assertIn("HUF783 no existe; se usa HUF763", avisos_ot2[0][1])
        self.assertEqual(ctx.reporte.contadores["ots_vehiculo_por_id_vehiculo"], 1)

        errores = {i.id_origen: (i.codigo, i.motivo) for i in ctx.reporte.incidencias if i.nivel == "error"}
        self.assertEqual(set(errores), {"3", "4", "7"})
        self.assertEqual(errores["4"][0], "OT_VEHICULO_NO_RESUELTO")
        self.assertIn("(BCD444) no se importo", errores["4"][1])
        self.assertEqual(errores["7"][0], "OT_VEHICULO_NO_RESUELTO")
        self.assertIn("varias patentes", errores["7"][1])

    def test_resolucion_del_cliente(self) -> None:
        ctx, planes = self.procesar(
            [
                orden_row(id_ot="1", id_cliente="8"),
                orden_row(id_ot="2", line_number=3, id_cliente="0"),
                orden_row(id_ot="3", line_number=4, id_cliente="999"),
            ],
            [],
            clientes={"7": CLIENTE, "8": OTRO_CLIENTE},
        )

        self.assertEqual([p.cliente_id for p in planes], [OTRO_CLIENTE, None, None])
        self.assertEqual(codigos(ctx.reporte), ["OT_CLIENTE_DISTINTO_DEL_VEHICULO", "OT_CLIENTE_NO_RESUELTO"])
        self.assertEqual(ctx.reporte.contadores["ots_cliente_distinto_vehiculo"], 1)

    def test_fecha_y_kilometraje_desde_las_tareas(self) -> None:
        ctx, planes = self.procesar(
            [orden_row(fecha_ingreso="1900-01-01 00:00:00", kilometraje="0"), orden_row(id_ot="2", line_number=3, fecha_ingreso=None)],
            [
                tarea_row(id_tarea="10", fecha_realizado="2014-08-25 09:00:00", kilometraje="1000"),
                tarea_row(id_tarea="11", fecha_realizado="2014-08-24 09:00:00", kilometraje="1500"),
                tarea_row(id_tarea="12", id_ot="2", fecha_realizado=None),
            ],
        )

        (plan,) = planes
        self.assertEqual(plan.fecha.isoformat(), "2014-08-24T09:00:00-03:00")
        self.assertEqual(plan.kilometraje, 1500)
        self.assertEqual([d.id_tarea for d in plan.detalles], ["11", "10"])
        self.assertIn("OT_FECHA_DESDE_TAREAS", codigos(ctx.reporte))
        self.assertIn("OT_SIN_FECHA", codigos(ctx.reporte, "error"))
        self.assertEqual(ctx.reporte.contadores["ots_kilometraje_desde_tareas"], 1)

    def test_descripcion_sin_tareas_y_fallbacks(self) -> None:
        _, planes = self.procesar(
            [orden_row(solicitud_cliente="Pedido"), orden_row(id_ot="2", line_number=3), orden_row(id_ot="3", line_number=4)],
            [tarea_row(id_ot="3", descripcion=None, grupo_tarea="Frenos"), tarea_row(id_tarea="11", id_ot="3", descripcion=None)],
        )

        self.assertEqual(
            [p.descripcion for p in planes],
            ["Pedido", migrador.DESCRIPCION_ARREGLO_FALLBACK, "Frenos | " + migrador.DESCRIPCION_TAREA_FALLBACK],
        )
        self.assertEqual([len(p.detalles) for p in planes], [0, 0, 2])
        self.assertEqual([p.precio_final for p in planes], [Decimal("0.00"), Decimal("0.00"), Decimal("2000.00")])

    def test_tarea_invalida_hace_fallar_su_ot(self) -> None:
        ctx, planes = self.procesar(
            [orden_row()],
            [tarea_row(), tarea_row(id_tarea="11", line_number=3, cant_horas_venta="10000")],
        )

        self.assertEqual(planes, [])
        errores = [(i.entidad, i.codigo, i.id_origen) for i in ctx.reporte.incidencias if i.nivel == "error"]
        self.assertEqual(
            errores,
            [("tarea", "TAREA_VALOR_FUERA_DE_RANGO", "11"), ("orden", "OT_TAREA_INVALIDA", "1"), ("tarea", "TAREA_OT_NO_IMPORTADA", "10")],
        )
        self.assertIn("IdTareaEnOT=11", ctx.reporte.incidencias[1].referencias)

    def test_tareas_de_ot_inexistente_o_duplicada(self) -> None:
        ctx, planes = self.procesar(
            [orden_row(id_ot="1"), orden_row(id_ot="2", line_number=3), orden_row(id_ot="2", line_number=4)],
            [tarea_row(id_ot="9"), tarea_row(id_tarea="11", id_ot="2")],
        )

        self.assertEqual([p.id_ot for p in planes], ["1"])
        self.assertEqual(
            codigos(ctx.reporte),
            ["OT_ID_DUPLICADO", "OT_ID_DUPLICADO", "TAREA_OT_INEXISTENTE", "TAREA_OT_NO_IMPORTADA"],
        )


# --------------------------------------------------------------------------
# Insercion, estado e idempotencia
# --------------------------------------------------------------------------


class InsercionTests(BaseTest):
    def supabase_con_vehiculo(self):
        return FakeSupabase({"vehiculos": [{"id": VEHICULO, "tenant_id": TENANT, "patente": "HUF763", "cliente_id": CLIENTE}]})

    def test_inserta_arreglos_y_detalles_y_actualiza_el_estado(self) -> None:
        supabase = self.supabase_con_vehiculo()
        ctx, planes = self.procesar([orden_row(total="1500")], [tarea_row()], supabase=supabase, dry_run=False)

        (arreglo,) = supabase.inserts("arreglos")
        self.assertEqual(arreglo["id"], planes[0].arreglo_id)
        self.assertEqual(len(supabase.inserts("detalle_arreglo")), 2)
        self.assertEqual(json.loads(ctx.estado.path.read_text(encoding="utf-8"))["ordenes"], {"1": arreglo["id"]})
        stats = ctx.reporte.estadisticas
        self.assertEqual((stats["orden"].creados, stats["tarea"].creados), (1, 1))

    def test_detalles_fallidos_borran_el_arreglo_y_se_aislan_por_ot(self) -> None:
        supabase = self.supabase_con_vehiculo()
        ctx = self.contexto(supabase)
        planes_ids = {}

        def fallar(table, rows):
            if table == "detalle_arreglo" and any(row["arreglo_id"] == planes_ids.get("2") for row in rows):
                return ErrorPostgrest("new row violates check constraint")
            return None

        supabase.fallar_insert = fallar
        ordenes = [orden_row(id_ot="1"), orden_row(id_ot="2", line_number=3), orden_row(id_ot="3", line_number=4)]
        tareas = [tarea_row(id_tarea=str(10 + n), id_ot=str(n)) for n in (1, 2, 3)]
        original = migrador.insertar_arreglos

        def capturar(ctx_, planes):
            planes_ids.update({p.id_ot: p.arreglo_id for p in planes})
            original(ctx_, planes)

        with mock.patch.object(migrador, "insertar_arreglos", capturar):
            migrador.procesar_ordenes(ctx, ordenes, tareas, {"7": CLIENTE}, mapa_vehiculos(), migrador.MapaOperarios(), {})

        self.assertEqual({row["id"] for row in supabase.tablas["arreglos"]}, {planes_ids["1"], planes_ids["3"]})
        self.assertEqual(len(supabase.tablas["detalle_arreglo"]), 2)
        self.assertEqual(set(ctx.estado.ordenes), {"1", "3"})
        errores = [(i.codigo, i.id_origen) for i in ctx.reporte.incidencias if i.nivel == "error"]
        self.assertEqual(errores, [("OT_DETALLES_FALLARON", "2"), ("TAREA_OT_NO_IMPORTADA", "12")])

    def test_fallo_de_compensacion_es_fatal(self) -> None:
        supabase = self.supabase_con_vehiculo()
        supabase.fallar_insert = lambda table, _rows: ErrorPostgrest("fallo") if table == "detalle_arreglo" else None
        original_execute = supabase.execute

        def execute(query):
            if query.op == "delete":
                raise ErrorPostgrest("sin conexion")
            return original_execute(query)

        supabase.execute = execute

        with self.assertRaisesRegex(migrador.ErrorFatal, "eliminarlo manualmente"):
            self.procesar([orden_row()], [tarea_row()], supabase=supabase, dry_run=False)

    def test_valor_hora_modificado_por_el_trigger_aborta(self) -> None:
        supabase = self.supabase_con_vehiculo()

        def trigger_sin_migracion(table, rows):
            if table == "detalle_arreglo":
                for row in rows:
                    row["valor_hora_empleado"] = 12000.0

        supabase.al_insertar = trigger_sin_migracion

        with self.assertRaisesRegex(migrador.ErrorFatal, migrador.MIGRACION_REQUERIDA):
            ctx, _ = self.procesar([orden_row()], [tarea_row()], supabase=supabase, dry_run=False)

    def test_precio_recalculado_distinto_deja_el_arreglo_saldado(self) -> None:
        supabase = self.supabase_con_vehiculo()

        def trigger(table, rows):
            if table == "arreglos":
                for row in rows:
                    row["precio_final"] = 900.0

        supabase.al_insertar = trigger
        ctx, _ = self.procesar([orden_row()], [tarea_row()], supabase=supabase, dry_run=False)

        (arreglo,) = supabase.tablas["arreglos"]
        self.assertEqual(arreglo["total_cobrado"], 900.0)
        self.assertEqual(arreglo["precio_sin_iva"], 743.8)
        self.assertIn("OT_PRECIO_RECALCULADO_DIFIERE", codigos(ctx.reporte, "warning"))
        self.assertEqual(ctx.reporte.importe_total_migrado, Decimal("900.00"))

    def test_ot_ya_migrada_por_estado_o_por_marcador(self) -> None:
        supabase = self.supabase_con_vehiculo()
        supabase.tablas["arreglos"] = [
            {"id": "a-1", "tenant_id": TENANT, "extra_data": {"migracion": {"origen": "sistema-externo", "id_ot": "1"}}},
            {"id": "a-2", "tenant_id": TENANT, "extra_data": {"migracion": {"origen": "sistema-externo", "id_ot": "2"}}},
            {"id": "a-otro", "tenant_id": OTRO_TENANT, "extra_data": {"migracion": {"origen": "sistema-externo", "id_ot": "3"}}},
        ]
        supabase.tablas["detalle_arreglo"] = [
            {"id": "d-1", "tenant_id": TENANT, "arreglo_id": "a-1"},
            {"id": "d-2", "tenant_id": TENANT, "arreglo_id": "a-2"},
        ]
        estado = migrador.EstadoMigracion(self.tmp / "estado.json", TENANT, TALLER, migrador.ORIGEN_MIGRACION, ordenes={"1": "a-1"})

        ctx, planes = self.procesar(
            [orden_row(id_ot="1"), orden_row(id_ot="2", line_number=3), orden_row(id_ot="3", line_number=4)],
            [tarea_row(id_ot="1"), tarea_row(id_tarea="11", id_ot="2"), tarea_row(id_tarea="12", id_ot="2")],
            supabase=supabase,
            dry_run=False,
            estado=estado,
        )

        self.assertEqual([p.id_ot for p in planes], ["3"])
        self.assertEqual(ctx.estado.ordenes["2"], "a-2")
        stats = ctx.reporte.estadisticas
        self.assertEqual((stats["orden"].ya_migrados, stats["tarea"].ya_migrados), (2, 3))
        self.assertIn(("arreglos", "extra_data->migracion->>origen", "sistema-externo"), supabase.equals)

    def test_arreglo_migrado_sin_detalles_se_borra_y_se_recrea(self) -> None:
        supabase = self.supabase_con_vehiculo()
        supabase.tablas["arreglos"] = [{"id": "a-1", "tenant_id": TENANT, "extra_data": None}]
        estado = migrador.EstadoMigracion(self.tmp / "estado.json", TENANT, TALLER, migrador.ORIGEN_MIGRACION, ordenes={"1": "a-1"})

        ctx, planes = self.procesar([orden_row()], [tarea_row()], supabase=supabase, dry_run=False, estado=estado)

        self.assertNotIn("a-1", {row["id"] for row in supabase.tablas["arreglos"]})
        self.assertEqual(ctx.estado.ordenes["1"], planes[0].arreglo_id)
        self.assertIn("ESTADO_ARREGLO_SIN_DETALLES", codigos(ctx.reporte))


class EstadoTests(BaseTest):
    def test_ida_y_vuelta(self) -> None:
        path = self.tmp / "estado.json"
        estado = migrador.EstadoMigracion(path, TENANT, TALLER, "sistema-externo", clientes={"7": CLIENTE}, vehiculos={"HUF763": VEHICULO})
        estado.guardar()

        cargado = migrador.EstadoMigracion.cargar(path, TENANT, TALLER, "sistema-externo")

        self.assertEqual((cargado.clientes, cargado.vehiculos), ({"7": CLIENTE}, {"HUF763": VEHICULO}))
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(data["version"], 1)
        self.assertEqual(set(data), {"version", "tenant_id", "taller_id", "origen", "actualizado_at", *migrador.SECCIONES_ESTADO})

    def test_estado_de_otro_tenant_taller_u_origen_es_fatal(self) -> None:
        path = self.tmp / "estado.json"
        migrador.EstadoMigracion(path, TENANT, TALLER, "sistema-externo").guardar()
        for argumentos in ((OTRO_TENANT, TALLER, "sistema-externo"), (TENANT, OTRO_TALLER, "sistema-externo"), (TENANT, TALLER, "otro")):
            with self.subTest(argumentos=argumentos), self.assertRaises(migrador.ErrorFatal):
                migrador.EstadoMigracion.cargar(path, *argumentos)

    def test_descarta_ids_inexistentes_y_limpia_clientes_huerfanos(self) -> None:
        huerfano = "10000000-0000-0000-0000-000000000009"
        supabase = FakeSupabase(
            {
                "clientes": [
                    {"id": CLIENTE, "tenant_id": TENANT},
                    {"id": huerfano, "tenant_id": TENANT},
                ],
                "particulares": [{"id": CLIENTE, "tenant_id": TENANT, "dni_cuil": "12345678"}],
                "empleados": [{"id": "e-otro-taller", "tenant_id": TENANT, "taller_id": OTRO_TALLER}],
            }
        )
        estado = migrador.EstadoMigracion(
            self.tmp / "estado.json", TENANT, TALLER, "sistema-externo",
            clientes={"7": CLIENTE, "9": huerfano, "10": OTRO_CLIENTE},
            operarios={"4": "e-otro-taller"},
        )
        ctx = self.contexto(supabase, estado=estado)

        migrador.validar_estado_en_base(ctx)

        self.assertEqual(ctx.estado.clientes, {"7": CLIENTE})
        self.assertEqual(ctx.estado.operarios, {})
        self.assertEqual([row["id"] for row in supabase.tablas["clientes"]], [CLIENTE])
        self.assertEqual(
            sorted(codigos(ctx.reporte)),
            ["ESTADO_CLIENTE_HUERFANO", "ESTADO_ID_INEXISTENTE", "ESTADO_ID_INEXISTENTE"],
        )

    def test_huerfano_con_vehiculos_es_fatal(self) -> None:
        supabase = FakeSupabase(
            {
                "clientes": [{"id": CLIENTE, "tenant_id": TENANT}],
                "vehiculos": [{"id": VEHICULO, "tenant_id": TENANT, "cliente_id": CLIENTE}],
            }
        )
        estado = migrador.EstadoMigracion(self.tmp / "estado.json", TENANT, TALLER, "sistema-externo", clientes={"7": CLIENTE})

        with self.assertRaisesRegex(migrador.ErrorFatal, "revisarlos manualmente"):
            migrador.validar_estado_en_base(self.contexto(supabase, estado=estado))


# --------------------------------------------------------------------------
# Ejecucion completa
# --------------------------------------------------------------------------


FIXTURES = {
    "clientes.csv": [
        f"1;TALLERES DEL SUR SA;;{cuit('30', '71234567')};0;Av Siempreviva;742;;;Quilmes;BA;;;info@sur.com;;;1;",
        "2;PEREZ JUAN;;0;12345678;;;;;;;;;juan@example.com;1162559377;;1;VIP",
        "3;GOMEZ ANA;;;;;;;;;;;;;;;1;",
    ],
    "vehiculos.csv": [
        "2006;MERCEDES BENZ;SPRINTER 311;;2006;BLANCO;TALLERES DEL SUR;1;8AC9036617A953696;611981-70-053190",
        "962KGF;ROUSER;ROUSER;;;AZUL;PEREZ JUAN;2;;",
        "AB123CD;FORD;KA;1.0;2015;ROJO;GOMEZ ANA;3;;",
    ],
    "operarios.csv": [
        "4;Gustavo;Calle 1;1155;;12000.00;20000.00",
        "5;Juan Carlos Perez;;;;;",
    ],
    "ordenesTrabajo.csv": [
        "1;1;3;2006;1;7;10;277;;8;2014-08-22 11:32:53.790;85000;Ruido;;;;;3000.00;0;0;0;0.00",
        "2;2;4;962KGF;2;7;10;277;;8;2015-01-10 09:00:00;0;;;;;;500.00;0;0;0;0.00",
        "3;3;5;AB123CD;1;7;10;277;;8;2016-05-02;12000;;;;;;0;0;0;0;0.00",
    ],
    "tareasEnOT.csv": [
        "10;1;Cambio de aceite;Service;4;1;1;1000;1000;1;600;600;2014-08-22 12:00:00;85000",
        "11;1;Frenos;Frenos;5;2;2;500;1000;2;0;0;2014-08-22 13:00:00;85000",
        "12;2;Alineacion;Tren delantero;0;1;1;800;800;0;0;0;;",
    ],
}


class MainTests(BaseTest):
    def ejecutar_main(self, supabase, *extra_args):
        with mock.patch.object(migrador, "TENANT_ID", TENANT), mock.patch.object(migrador, "TALLER_ID", TALLER), \
                mock.patch.object(migrador, "create_supabase_client", lambda _timeout: supabase):
            return migrador.main([str(self.tmp / "csv"), *extra_args])

    def supabase_destino(self):
        return FakeSupabase(
            {
                "tenants": [{"id": TENANT, "nombre": "Tenant de prueba"}],
                "talleres": [{"id": TALLER, "nombre": "Sede Central", "tenant_id": TENANT}],
                "categorias_arreglo": [{"id": "b1000000-0000-0000-0000-000000000001", "tenant_id": TENANT, "nombre": "Service"}],
            }
        )

    def test_placeholders_commiteados_impiden_la_ejecucion(self) -> None:
        with self.assertRaisesRegex(migrador.ErrorFatal, "TENANT_ID/TALLER_ID"):
            migrador.validate_config()

    def test_dry_run_no_escribe_en_la_base_ni_el_estado(self) -> None:
        self.escribir_csvs(self.tmp / "csv", FIXTURES)
        supabase = self.supabase_destino()

        codigo = self.ejecutar_main(supabase, "--dry-run")

        self.assertEqual(codigo, 0)
        self.assertEqual(supabase.escrituras, [])
        self.assertFalse((self.tmp / "csv" / f"migracion_estado_{TENANT}.json").exists())
        self.assertTrue((self.tmp / "csv" / "reporte_migracion_dry_run.csv").exists())

    def test_ejecucion_real_reejecucion_y_reporte_sin_datos_personales(self) -> None:
        self.escribir_csvs(self.tmp / "csv", FIXTURES)
        supabase = self.supabase_destino()

        primera = self.ejecutar_main(supabase)

        self.assertEqual(primera, 0)
        self.assertEqual(len(supabase.tablas["clientes"]), 3)
        self.assertEqual(len(supabase.tablas["empresas"]), 1)
        self.assertEqual(len(supabase.tablas["vehiculos"]), 3)
        self.assertEqual(len(supabase.tablas["empleados"]), 2)
        self.assertEqual(len(supabase.tablas["arreglos"]), 3)
        # 2 tareas + ajuste en la OT 1, 1 tarea en la OT 2 (Total menor), OT 3 sin tareas.
        self.assertEqual(len(supabase.tablas["detalle_arreglo"]), 4)
        self.assertEqual(
            sorted(row["nombre"] for row in supabase.tablas["categorias_arreglo"]),
            ["Frenos", "Service", "Tren delantero"],
        )
        arreglos = {row["extra_data"]["migracion"]["id_ot"]: row for row in supabase.tablas["arreglos"]}
        self.assertEqual(arreglos["1"]["precio_final"], 3000.0)
        self.assertEqual(arreglos["2"]["precio_final"], 800.0)
        self.assertEqual(arreglos["3"]["precio_final"], 0.0)
        self.assertTrue(all(row["total_cobrado"] == row["precio_final"] for row in arreglos.values()))
        empleados = {row["nombre"]: row for row in supabase.tablas["empleados"]}
        self.assertEqual((empleados["Gustavo"]["apellido"], empleados["Gustavo"]["dni"]), (" ", "99000004"))

        with (self.tmp / "csv" / "reporte_migracion.csv").open(encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file, delimiter=";")
            self.assertEqual(tuple(reader.fieldnames), migrador.REPORTE_CAMPOS)
            contenido = " ".join(" ".join(row.values()) for row in reader)
        for dato_personal in ("PEREZ", "Gustavo", "juan@example.com", "12345678", "1162559377", "99000004"):
            self.assertNotIn(dato_personal, contenido)

        conteos = {table: len(rows) for table, rows in supabase.tablas.items()}
        escrituras = len(supabase.escrituras)

        segunda = self.ejecutar_main(supabase)

        self.assertEqual(segunda, 0)
        self.assertEqual({table: len(rows) for table, rows in supabase.tablas.items()}, conteos)
        self.assertEqual(len(supabase.escrituras), escrituras)

    def test_reejecucion_sin_estado_usa_claves_naturales_y_marcador(self) -> None:
        self.escribir_csvs(self.tmp / "csv", FIXTURES)
        supabase = self.supabase_destino()
        self.ejecutar_main(supabase)
        (self.tmp / "csv" / f"migracion_estado_{TENANT}.json").unlink()

        self.ejecutar_main(supabase)

        # Solo el cliente sin documento (GOMEZ ANA) se duplica: riesgo documentado.
        self.assertEqual(len(supabase.tablas["clientes"]), 4)
        self.assertEqual(len(supabase.tablas["empleados"]), 2)
        self.assertEqual(len(supabase.tablas["arreglos"]), 3)

    def test_codigo_de_salida_con_errores_por_registro(self) -> None:
        filas = dict(FIXTURES)
        filas["vehiculos.csv"] = [*FIXTURES["vehiculos.csv"], "ZZ999ZZ;FIAT;UNO;;2000;;X;99;;"]
        self.escribir_csvs(self.tmp / "csv", filas)

        codigo = self.ejecutar_main(self.supabase_destino())

        self.assertEqual(codigo, 1)


if __name__ == "__main__":
    unittest.main()
