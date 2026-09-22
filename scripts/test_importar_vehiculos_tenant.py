"""Pruebas unitarias del importador conjunto de clientes y vehiculos."""

from __future__ import annotations

import csv
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("importar_vehiculos_tenant.py")
SPEC = importlib.util.spec_from_file_location("importar_vehiculos_tenant", SCRIPT_PATH)
assert SPEC and SPEC.loader
importer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = importer
SPEC.loader.exec_module(importer)


class ImportarVehiculosTenantTests(unittest.TestCase):
    def make_client_row(self, **overrides):
        values = {
            "line_number": 2,
            "codigo": "4",
            "razon_social": "PROPEL SACIEI",
            "nombre_fantasia": "PROPEL",
            "tipo_documento": "CUIT",
            "cuit": "33-50549957-9",
            "nro_documento": "0",
            "telefono_fijo": "1147683190",
            "celular": "1162559377",
            "calle": "CALLE 35",
            "numero": "3443",
            "piso": None,
            "depto": None,
            "codigo_postal": None,
            "localidad": "San Andres",
            "provincia": "BUENOS AIRES",
            "email": "alejandro.pernia@propel-sa.com.ar",
        }
        values.update(overrides)
        return importer.ClienteCsv(**values)

    def test_client_csv_reads_the_expected_headers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "clientes.csv"
            path.write_text(
                "Codigo;Razon Social;Nombre Fantasia;T.Doc.;CUIT;Nro Documento;Tel. Fijo;Celular;Calle;Numero;Piso;Depto;Cod.Postal;Localidad;Provincia;Email\n"
                "4;PROPEL SACIEI;PROPEL;CUIT;33-50549957-9;0;1147683190;1162559377;CALLE 35;3443;;;;San Andres;BUENOS AIRES;alejandro.pernia@propel-sa.com.ar\n",
                encoding="utf-8",
            )
            rows = list(importer.read_clientes_csv(path))

        self.assertEqual(rows[0].codigo, "4")
        self.assertEqual(rows[0].razon_social, "PROPEL SACIEI")
        self.assertEqual(rows[0].telefono_fijo, "1147683190")

    def test_company_uses_razon_social_celular_and_composed_address(self) -> None:
        client = importer.classify_cliente(self.make_client_row())

        self.assertEqual(client.tipo_cliente, "empresa")
        self.assertEqual(client.nombre, "PROPEL SACIEI")
        self.assertEqual(client.telefono, "1162559377")
        self.assertEqual(client.direccion, "CALLE 35 3443, San Andres, BUENOS AIRES")

    def test_particular_uses_razon_social_as_nombre_and_empty_apellido(self) -> None:
        client = importer.classify_cliente(
            self.make_client_row(
                razon_social="PEREZ JUAN",
                tipo_documento="CUIL",
                cuit="20-12345678-6",
                nro_documento="12345678",
                celular=None,
            )
        )

        self.assertEqual(client.tipo_cliente, "particular")
        self.assertEqual(client.nombre, "PEREZ JUAN")
        self.assertEqual(client.apellido, "")
        self.assertEqual(client.telefono, "1147683190")
        self.assertEqual(client.identificacion, "20123456786")

    def test_dni_in_nro_documento_creates_a_particular(self) -> None:
        client = importer.classify_cliente(
            self.make_client_row(cuit=None, nro_documento="12.345.678", tipo_documento="DNI")
        )

        self.assertEqual(client.tipo_cliente, "particular")
        self.assertEqual(client.identificacion, "12345678")

    def test_vehicle_uses_id_cliente_and_concatenates_model_version(self) -> None:
        vehicle = importer.prepare_vehiculo(
            importer.VehiculoCsv(
                line_number=2,
                patente="ab 123 cd",
                marca="Porsche",
                modelo="956",
                version="Turbo",
                anio="1983",
                color="Rojo",
                id_cliente="4",
                chasis="abc",
                motor="motor 1",
            )
        )
        payload = importer.vehicle_payload(vehicle, "tenant-id", "cliente-id")

        self.assertEqual(vehicle.id_cliente, "4")
        self.assertEqual(payload["modelo"], "956 Turbo")
        self.assertEqual(payload["numero_chasis"], "ABC")
        self.assertEqual(payload["numero_motor"], "MOTOR 1")

    def test_errors_report_contains_client_and_vehicle_context(self) -> None:
        client_row = self.make_client_row()
        vehicle_row = importer.VehiculoCsv(
            line_number=4,
            patente="AB123CD",
            marca="Porsche",
            modelo="956",
            version=None,
            anio="1983",
            color="Rojo",
            id_cliente="4",
            chasis="ABC",
            motor="M1",
        )
        errors = [
            importer.ErrorImportacion("cliente", "el codigo se repite en el padron", cliente=client_row),
            importer.ErrorImportacion("vehiculo", "Id Cliente no existe", vehiculo=vehicle_row),
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            report_path = Path(temporary_directory) / "errores.txt"
            importer.write_errors(report_path, errors)
            with report_path.open(encoding="utf-8", newline="") as report_file:
                rows = list(csv.DictReader(report_file, delimiter=";"))

        self.assertEqual(rows[0]["codigo_cliente"], "4")
        self.assertIn("razon_social=PROPEL SACIEI", rows[0]["datos_origen"])
        self.assertEqual(rows[1]["id_cliente_origen"], "4")
        self.assertEqual(rows[1]["patente"], "AB123CD")

    def create_fake_supabase(self):
        class Response:
            def __init__(self, data):
                self.data = data

        class Query:
            def __init__(self, supabase, table_name):
                self.supabase = supabase
                self.table_name = table_name
                self.payload = None
                self.deleted = False

            def select(self, *_args):
                return self

            def eq(self, *_args):
                self.supabase.equals.append((self.table_name, *_args))
                return self

            def in_(self, *_args):
                return self

            def limit(self, *_args):
                return self

            def range(self, *_args):
                return self

            def insert(self, payload, **_kwargs):
                self.payload = payload
                return self

            def delete(self):
                self.deleted = True
                return self

            def execute(self):
                if self.payload is not None:
                    self.supabase.inserts.append((self.table_name, self.payload))
                if self.deleted:
                    self.supabase.deleted_tables.append(self.table_name)
                return Response([])

        class FakeSupabase:
            def __init__(self):
                self.inserts = []
                self.deleted_tables = []
                self.equals = []

            def table(self, table_name):
                return Query(self, table_name)

        return FakeSupabase()

    def test_existing_client_lookup_is_scoped_to_the_target_tenant(self) -> None:
        supabase = self.create_fake_supabase()

        importer.process_clientes(
            supabase,
            "tenant-id",
            [self.make_client_row()],
            False,
            [],
            250,
        )

        self.assertIn(("empresas", "tenant_id", "tenant-id"), supabase.equals)

    def test_processes_clients_before_vehicles_and_links_by_code(self) -> None:
        supabase = self.create_fake_supabase()
        errors = []
        client_map, created_clients, _ = importer.process_clientes(
            supabase, "tenant-id", [self.make_client_row()], False, errors, 250
        )
        vehicle_row = importer.VehiculoCsv(
            line_number=3,
            patente="AB123CD",
            marca="Porsche",
            modelo="956",
            version=None,
            anio="1983",
            color="Rojo",
            id_cliente="4",
            chasis="ABC",
            motor="M1",
        )
        _, created_vehicles, _ = importer.process_vehiculos(
            supabase, "tenant-id", [vehicle_row], client_map, set(), False, errors, 100, 250
        )

        self.assertEqual(errors, [])
        self.assertEqual(created_clients, 1)
        self.assertEqual(created_vehicles, 1)
        self.assertIsNotNone(client_map["4"].cliente_id)
        vehicle_insert = next(payload for table, payload in supabase.inserts if table == "vehiculos")
        self.assertEqual(vehicle_insert[0]["cliente_id"], client_map["4"].cliente_id)

    def test_inserts_clients_and_vehicles_in_batches_of_250(self) -> None:
        supabase = self.create_fake_supabase()
        client_rows = [
            self.make_client_row(
                line_number=index + 2,
                codigo=str(index),
                cuit=None,
                nro_documento=f"{1_000_000 + index:07d}",
                tipo_documento="DNI",
            )
            for index in range(251)
        ]
        errors = []
        client_map, created_clients, _ = importer.process_clientes(
            supabase, "tenant-id", client_rows, False, errors, 250
        )
        vehicle_rows = [
            importer.VehiculoCsv(
                line_number=index + 2,
                patente=f"AA{index:03d}AA",
                marca="Marca",
                modelo="Modelo",
                version=None,
                anio="2020",
                color="Rojo",
                id_cliente=str(index),
                chasis=f"CH{index}",
                motor=f"MO{index}",
            )
            for index in range(251)
        ]
        _, created_vehicles, _ = importer.process_vehiculos(
            supabase, "tenant-id", vehicle_rows, client_map, set(), False, errors, 100, 250
        )

        self.assertEqual(errors, [])
        self.assertEqual(created_clients, 251)
        self.assertEqual(created_vehicles, 251)
        self.assertEqual(
            [len(payload) for table, payload in supabase.inserts if table == "clientes"],
            [250, 1],
        )
        self.assertEqual(
            [len(payload) for table, payload in supabase.inserts if table == "particulares"],
            [250, 1],
        )
        self.assertEqual(
            [len(payload) for table, payload in supabase.inserts if table == "vehiculos"],
            [250, 1],
        )

    def test_missing_or_invalid_identification_creates_separate_particulares_without_dni(self) -> None:
        supabase = self.create_fake_supabase()
        client_map, created, _ = importer.process_clientes(
            supabase,
            "tenant-id",
            [
                self.make_client_row(codigo="sin-documento", cuit=None, nro_documento=None),
                self.make_client_row(codigo="documento-invalido", cuit="invalido", nro_documento="123"),
            ],
            False,
            [],
            250,
        )

        self.assertEqual(created, 2)
        particular_payload = next(payload for table, payload in supabase.inserts if table == "particulares")
        self.assertEqual([row["dni_cuil"] for row in particular_payload], [None, None])
        self.assertNotEqual(
            client_map["sin-documento"].cliente_id,
            client_map["documento-invalido"].cliente_id,
        )

    def test_failed_detail_batch_reverts_the_base_clients(self) -> None:
        class Response:
            data = []

        class Query:
            def __init__(self, supabase, table_name):
                self.supabase = supabase
                self.table_name = table_name
                self.payload = None
                self.deleted = False

            def insert(self, payload, **_kwargs):
                self.payload = payload
                return self

            def delete(self):
                self.deleted = True
                return self

            def in_(self, *_args):
                return self

            def execute(self):
                if self.table_name == "particulares" and self.payload is not None:
                    raise RuntimeError("detalle invalido")
                if self.deleted:
                    self.supabase.deleted_clients = True
                return Response()

        class FakeSupabase:
            def __init__(self):
                self.deleted_clients = False

            def table(self, table_name):
                return Query(self, table_name)

        row = self.make_client_row(cuit=None, nro_documento="12345678", tipo_documento="DNI")
        pending = importer.ClientePendiente("cliente-id", importer.classify_cliente(row), [row])
        supabase = FakeSupabase()

        with self.assertRaisesRegex(RuntimeError, "detalle invalido"):
            importer.insert_clientes_lote(supabase, "tenant-id", [pending])

        self.assertTrue(supabase.deleted_clients)


if __name__ == "__main__":
    unittest.main()
