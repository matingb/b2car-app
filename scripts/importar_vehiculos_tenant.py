#!/usr/bin/env python3
"""Importa un padron de clientes y sus vehiculos desde dos archivos CSV.

Uso:
    # PowerShell
    $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
    python scripts/importar_vehiculos_tenant.py clientes.csv vehiculos.csv --dry-run
    python scripts/importar_vehiculos_tenant.py clientes.csv vehiculos.csv

Instalacion:
    python -m pip install -r scripts/requirements-importar-clientes.txt

La asignacion se resuelve unicamente con ``Codigo`` del padron de clientes e
``Id Cliente`` del archivo de vehiculos. El codigo no se persiste en la base:
solo se usa durante esta ejecucion para obtener el ``cliente_id`` creado o
reutilizado.

Las filas de clientes o vehiculos que no se puedan importar se escriben en
``errores.txt`` junto al CSV de vehiculos, o en la ruta indicada con
``--errores-path``.

Las inserciones se envian a la Data API en lotes de hasta 250 filas. Cuando
una fila de cliente no tiene CUIT/CUIL ni DNI validos se inserta como
``particular`` con ``dni_cuil`` nulo, sin inventar un documento.
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Callable, Iterable, TypeVar
from uuid import UUID, uuid4


# Debe coincidir con el importador de clientes asociado a esta migracion.
# No se recibe por argumento para evitar importar accidentalmente otro tenant.
# ID del tenant: 11111111-1111-1111-1111-111111111111
#TENANT_ID = "11111111-1111-1111-1111-111111111111"
TENANT_ID = "c511e72b-15d6-4a75-9015-55724778027a"
COMPANY_CUIT_PREFIXES = {"30", "33", "34"}
PERSON_CUIL_PREFIXES = {"20", "23", "24", "27"}
DEFAULT_BATCH_SIZE = 250
T = TypeVar("T")

CLIENT_REQUIRED_COLUMNS = {
    "codigo": {"codigo"},
    "razon_social": {"razon social"},
    "cuit": {"cuit"},
    "nro_documento": {"nro documento", "numero documento"},
}
CLIENT_OPTIONAL_COLUMNS = {
    "nombre_fantasia": {"nombre fantasia"},
    "tipo_documento": {"t doc", "tipo documento", "tdoc"},
    "telefono_fijo": {"tel fijo", "telefono fijo", "telefono"},
    "celular": {"celular", "movil"},
    "calle": {"calle"},
    "numero": {"numero", "nro", "n"},
    "piso": {"piso"},
    "depto": {"depto", "departamento", "dpto"},
    "codigo_postal": {"cod postal", "codigo postal", "cp"},
    "localidad": {"localidad"},
    "provincia": {"provincia"},
    "email": {"email", "mail", "correo"},
}
VEHICLE_REQUIRED_COLUMNS = {
    "patente": {"patente"},
    "marca": {"marca"},
    "modelo": {"modelo"},
    "version": {"version"},
    "anio": {"anio", "ano"},
    "color": {"color"},
    "id_cliente": {"id cliente", "id_cliente"},
    "chasis": {"chasis", "numero chasis", "nro chasis"},
    "motor": {"motor", "numero motor", "nro motor"},
}
ERROR_REPORT_FIELDS = (
    "origen",
    "linea_csv",
    "motivo",
    "codigo_cliente",
    "id_cliente_origen",
    "patente",
    "datos_origen",
)
@dataclass(frozen=True)
class ClienteCsv:
    line_number: int
    codigo: str | None
    razon_social: str | None
    nombre_fantasia: str | None
    tipo_documento: str | None
    cuit: str | None
    nro_documento: str | None
    telefono_fijo: str | None
    celular: str | None
    calle: str | None
    numero: str | None
    piso: str | None
    depto: str | None
    codigo_postal: str | None
    localidad: str | None
    provincia: str | None
    email: str | None


@dataclass(frozen=True)
class ClienteImportable:
    line_number: int
    codigo: str
    tipo_cliente: str
    nombre: str
    apellido: str | None
    identificacion: str | None
    direccion: str | None
    telefono: str | None
    email: str | None


@dataclass(frozen=True)
class VehiculoCsv:
    line_number: int
    patente: str | None
    marca: str | None
    modelo: str | None
    version: str | None
    anio: str | None
    color: str | None
    id_cliente: str | None
    chasis: str | None
    motor: str | None


@dataclass(frozen=True)
class VehiculoImportable:
    line_number: int
    patente: str
    marca: str
    modelo: str
    version: str | None
    anio: str
    color: str
    id_cliente: str
    chasis: str
    motor: str


@dataclass(frozen=True)
class ClienteResuelto:
    cliente_id: str | None
    line_number: int


@dataclass(frozen=True)
class ErrorImportacion:
    origen: str
    motivo: str
    cliente: ClienteCsv | None = None
    vehiculo: VehiculoCsv | VehiculoImportable | None = None


@dataclass
class ClientePendiente:
    cliente_id: str
    cliente: ClienteImportable
    source_rows: list[ClienteCsv]


@dataclass(frozen=True)
class VehiculoPendiente:
    row: VehiculoCsv
    vehiculo: VehiculoImportable
    cliente_id: str


def normalizar_texto(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().split())
    return normalized or None


def normalizar_encabezado(value: str) -> str:
    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", without_accents.casefold()).strip()


def normalizar_codigo(value: str | None) -> str | None:
    text = normalizar_texto(value)
    return text.casefold() if text is not None else None


def normalizar_identificacion(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None or text == "0":
        return None
    digits = re.sub(r"\D", "", text)
    if not digits:
        raise ValueError("el identificador no contiene digitos")
    return digits


def normalizar_identificacion_opcional(value: str | None) -> str | None:
    try:
        return normalizar_identificacion(value)
    except ValueError:
        return None


def normalizar_patente(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    normalized = re.sub(r"[^0-9A-Za-z]", "", text).upper()
    return normalized or None


def positions_for_headers(headers: list[str], aliases: set[str]) -> list[int]:
    return [
        index
        for index, header in enumerate(headers)
        if normalizar_encabezado(header) in aliases
    ]


def first_value(values: list[str], positions: Iterable[int]) -> str | None:
    for position in positions:
        value = normalizar_texto(values[position] if position < len(values) else None)
        if value is not None:
            return value
    return None


def detect_csv_dialect(file) -> csv.Dialect:
    sample = file.read(4096)
    file.seek(0)
    try:
        return csv.Sniffer().sniff(sample, delimiters=";,")
    except csv.Error:
        return csv.excel


def read_csv_rows(
    csv_path: Path, required: dict[str, set[str]], optional: dict[str, set[str]]
) -> Iterable[tuple[int, dict[str, str | None]]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file, dialect=detect_csv_dialect(file))
        try:
            headers = next(reader)
        except StopIteration as error:
            raise ValueError(f"el CSV esta vacio: {csv_path}") from error

        positions = {
            field: positions_for_headers(headers, aliases)
            for field, aliases in {**required, **optional}.items()
        }
        missing = [field for field in required if not positions[field]]
        if missing:
            raise ValueError(
                f"el CSV {csv_path.name} no incluye los encabezados requeridos: {', '.join(missing)}"
            )

        for line_number, values in enumerate(reader, start=2):
            if not any(normalizar_texto(value) for value in values):
                continue
            yield line_number, {
                field: first_value(values, field_positions)
                for field, field_positions in positions.items()
            }


def read_clientes_csv(csv_path: Path) -> Iterable[ClienteCsv]:
    for line_number, values in read_csv_rows(csv_path, CLIENT_REQUIRED_COLUMNS, CLIENT_OPTIONAL_COLUMNS):
        yield ClienteCsv(line_number=line_number, **values)


def read_vehiculos_csv(csv_path: Path) -> Iterable[VehiculoCsv]:
    for line_number, values in read_csv_rows(csv_path, VEHICLE_REQUIRED_COLUMNS, {}):
        yield VehiculoCsv(line_number=line_number, **values)


def identificacion_11_es_valida(identificacion: str) -> bool:
    if len(identificacion) != 11 or not identificacion.isdigit():
        return False
    weights = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    remainder = sum(int(digit) * weight for digit, weight in zip(identificacion[:10], weights)) % 11
    check_digit = 11 - remainder
    if check_digit == 11:
        check_digit = 0
    elif check_digit == 10:
        check_digit = 9
    return check_digit == int(identificacion[-1])


def is_dni(value: str | None) -> bool:
    return bool(value and len(value) in {7, 8} and value.isdigit())


def build_address(row: ClienteCsv) -> str | None:
    street = normalizar_texto(row.calle)
    number = normalizar_texto(row.numero)
    floor = normalizar_texto(row.piso)
    department = normalizar_texto(row.depto)
    postal_code = normalizar_texto(row.codigo_postal)
    locality = normalizar_texto(row.localidad)
    province = normalizar_texto(row.provincia)

    parts: list[str] = []
    if street and number and number != "0":
        parts.append(f"{street} {number}")
    elif street:
        parts.append(street)
    elif number and number != "0":
        parts.append(f"Numero {number}")
    if floor and floor != "0":
        parts.append(f"Piso {floor}")
    if department and department != "0":
        parts.append(f"Depto {department}")
    if postal_code and postal_code != "0":
        parts.append(f"CP {postal_code}")
    if locality:
        parts.append(locality)
    if province:
        parts.append(province)
    return ", ".join(parts) or None


def classify_cliente(row: ClienteCsv) -> ClienteImportable:
    codigo = normalizar_codigo(row.codigo)
    if codigo is None:
        raise ValueError("el codigo es obligatorio")
    razon_social = normalizar_texto(row.razon_social)
    if razon_social is None:
        raise ValueError("la razon social es obligatoria")

    tax_id = normalizar_identificacion_opcional(row.cuit)
    document = normalizar_identificacion_opcional(row.nro_documento)
    type_label = normalizar_encabezado(row.tipo_documento or "")

    if tax_id is not None and len(tax_id) == 11 and identificacion_11_es_valida(tax_id):
        if tax_id[:2] in COMPANY_CUIT_PREFIXES:
            return ClienteImportable(
                line_number=row.line_number,
                codigo=codigo,
                tipo_cliente="empresa",
                nombre=razon_social,
                apellido=None,
                identificacion=tax_id,
                direccion=build_address(row),
                telefono=normalizar_texto(row.celular) or normalizar_texto(row.telefono_fijo),
                email=normalizar_texto(row.email),
            )
        if tax_id[:2] in PERSON_CUIL_PREFIXES or type_label == "cuil":
            return ClienteImportable(
                line_number=row.line_number,
                codigo=codigo,
                tipo_cliente="particular",
                nombre=razon_social,
                # particulares.apellido es NOT NULL: una cadena vacia conserva que
                # el padron no separa el apellido sin inventar informacion personal.
                apellido="",
                identificacion=tax_id,
                direccion=build_address(row),
                telefono=normalizar_texto(row.celular) or normalizar_texto(row.telefono_fijo),
                email=normalizar_texto(row.email),
            )

    if is_dni(document):
        return ClienteImportable(
            line_number=row.line_number,
            codigo=codigo,
            tipo_cliente="particular",
            nombre=razon_social,
            apellido="",
            identificacion=document,
            direccion=build_address(row),
            telefono=normalizar_texto(row.celular) or normalizar_texto(row.telefono_fijo),
            email=normalizar_texto(row.email),
        )

    return ClienteImportable(
        line_number=row.line_number,
        codigo=codigo,
        tipo_cliente="particular",
        nombre=razon_social,
        apellido="",
        identificacion=None,
        direccion=build_address(row),
        telefono=normalizar_texto(row.celular) or normalizar_texto(row.telefono_fijo),
        email=normalizar_texto(row.email),
    )


def prepare_vehiculo(row: VehiculoCsv) -> VehiculoImportable:
    patente = normalizar_patente(row.patente)
    if patente is None:
        raise ValueError("la patente es obligatoria")
    client_code = normalizar_codigo(row.id_cliente)
    if client_code is None:
        raise ValueError("Id Cliente es obligatorio")
    return VehiculoImportable(
        line_number=row.line_number,
        patente=patente,
        marca=normalizar_texto(row.marca) or "",
        modelo=normalizar_texto(row.modelo) or "",
        version=normalizar_texto(row.version),
        anio=normalizar_texto(row.anio) or "",
        color=normalizar_texto(row.color) or "",
        id_cliente=client_code,
        chasis=(normalizar_texto(row.chasis) or "").upper(),
        motor=(normalizar_texto(row.motor) or "").upper(),
    )


def display_model(vehiculo: VehiculoCsv | VehiculoImportable) -> str:
    return " ".join(
        value
        for value in (normalizar_texto(vehiculo.modelo), normalizar_texto(vehiculo.version))
        if value
    )


def validate_tenant_id() -> str:
    try:
        return str(UUID(TENANT_ID))
    except ValueError as error:
        raise ValueError("configura TENANT_ID con un UUID valido antes de ejecutar") from error


def positive_integer(value: str) -> int:
    try:
        result = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("debe ser un numero entero") from error
    if result <= 0:
        raise argparse.ArgumentTypeError("debe ser mayor que cero")
    return result


def execute_traced(phase: str, operation: Callable[[], T]) -> T:
    started_at = perf_counter()
    logging.debug("fase=%s inicio", phase)
    try:
        result = operation()
    except Exception:
        logging.debug("fase=%s fallo en %.2fs", phase, perf_counter() - started_at)
        raise
    logging.debug("fase=%s completada en %.2fs", phase, perf_counter() - started_at)
    return result


def create_supabase_client(request_timeout: int):
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url:
        raise RuntimeError("falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL en las variables de entorno")
    if not service_role_key:
        raise RuntimeError("falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno")
    try:
        from supabase import create_client
        from supabase.client import ClientOptions
    except ImportError as error:
        raise RuntimeError(
            "no se pudo cargar supabase: "
            f"{error}. Instala las dependencias con: "
            f"{sys.executable} -m pip install -r scripts/requirements-importar-clientes.txt"
        ) from error
    return execute_traced(
        "cliente_supabase",
        lambda: create_client(
            supabase_url,
            service_role_key,
            options=ClientOptions(postgrest_client_timeout=request_timeout, schema="public"),
        ),
    )


def fetch_paginated(phase: str, make_query: Callable[[], Any], page_size: int = 1000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        response = execute_traced(
            f"{phase}_{offset}",
            lambda: make_query().range(offset, offset + page_size - 1).execute(),
        )
        page = response.data or []
        if not isinstance(page, list):
            raise RuntimeError(f"{phase}: Supabase devolvio una respuesta inesperada")
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def chunked(values: list[T], size: int) -> Iterable[list[T]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def load_clientes_existentes(
    supabase: Any,
    tenant_id: str,
    tipo_cliente: str,
    identificaciones: set[str],
    batch_size: int,
) -> tuple[dict[str, str], set[str]]:
    """Carga identificadores existentes exclusivamente del tenant destino."""
    if not identificaciones:
        return {}, set()

    table = "empresas" if tipo_cliente == "empresa" else "particulares"
    field = "cuit" if tipo_cliente == "empresa" else "dni_cuil"
    rows: list[dict[str, Any]] = []
    for index, lote in enumerate(chunked(sorted(identificaciones), batch_size), start=1):
        rows.extend(
            fetch_paginated(
                f"consulta_{table}_existentes_lote_{index}",
                lambda lote=lote: supabase.table(table)
                .select(f"id,{field}")
                .in_(field, lote)
                .eq("tenant_id", tenant_id),
            )
        )

    clientes: dict[str, str] = {}
    duplicados: set[str] = set()
    for row in rows:
        identificacion = row.get(field)
        client_id = row.get("id")
        if not isinstance(identificacion, str) or not isinstance(client_id, str):
            raise RuntimeError("un cliente existente no tiene una relacion base valida")
        if identificacion in clientes:
            duplicados.add(identificacion)
        else:
            clientes[identificacion] = client_id
    return clientes, duplicados


def insert_clientes_lote(supabase: Any, tenant_id: str, lote: list[ClientePendiente]) -> None:
    client_ids = [pending.cliente_id for pending in lote]
    base_inserted = False
    try:
        execute_traced(
            f"insertar_clientes_lote_{lote[0].cliente.line_number}_{len(lote)}",
            lambda: supabase.table("clientes")
            .insert(
                [
                    {
                        "id": pending.cliente_id,
                        "tenant_id": tenant_id,
                        "tipo_cliente": pending.cliente.tipo_cliente,
                    }
                    for pending in lote
                ],
                returning="minimal",
            )
            .execute(),
        )
        base_inserted = True

        empresas = [pending for pending in lote if pending.cliente.tipo_cliente == "empresa"]
        if empresas:
            execute_traced(
                f"insertar_empresas_lote_{empresas[0].cliente.line_number}_{len(empresas)}",
                lambda: supabase.table("empresas")
                .insert(
                    [
                        {
                            "id": pending.cliente_id,
                            "nombre": pending.cliente.nombre,
                            "cuit": pending.cliente.identificacion,
                            "direccion": pending.cliente.direccion,
                            "email": pending.cliente.email,
                            "telefono": pending.cliente.telefono,
                        }
                        for pending in empresas
                    ],
                    returning="minimal",
                )
                .execute(),
            )

        particulares = [pending for pending in lote if pending.cliente.tipo_cliente == "particular"]
        if particulares:
            execute_traced(
                f"insertar_particulares_lote_{particulares[0].cliente.line_number}_{len(particulares)}",
                lambda: supabase.table("particulares")
                .insert(
                    [
                        {
                            "id": pending.cliente_id,
                            "nombre": pending.cliente.nombre,
                            "apellido": pending.cliente.apellido,
                            "dni_cuil": pending.cliente.identificacion,
                            "direccion": pending.cliente.direccion,
                            "email": pending.cliente.email,
                            "telefono": pending.cliente.telefono,
                        }
                        for pending in particulares
                    ],
                    returning="minimal",
                )
                .execute(),
            )
    except Exception as insert_error:
        if base_inserted:
            try:
                execute_traced(
                    f"revertir_clientes_lote_{lote[0].cliente.line_number}_{len(lote)}",
                    lambda: supabase.table("clientes").delete().in_("id", client_ids).execute(),
                )
            except Exception as rollback_error:
                raise RuntimeError("fallo un detalle del lote y no se pudieron revertir sus clientes base") from rollback_error
        raise insert_error


def insert_clientes_con_aislamiento(
    supabase: Any,
    tenant_id: str,
    lote: list[ClientePendiente],
    errors: list[ErrorImportacion],
) -> list[ClientePendiente]:
    try:
        insert_clientes_lote(supabase, tenant_id, lote)
        return lote
    except Exception as error:
        if len(lote) > 1:
            midpoint = len(lote) // 2
            return insert_clientes_con_aislamiento(supabase, tenant_id, lote[:midpoint], errors) + insert_clientes_con_aislamiento(
                supabase, tenant_id, lote[midpoint:], errors
            )
        pending = lote[0]
        for row in pending.source_rows:
            errors.append(ErrorImportacion("cliente", str(error), cliente=row))
            logging.error("cliente linea %s: %s", row.line_number, error)
        return []


def verify_vehicle_columns(supabase: Any) -> None:
    execute_traced(
        "validacion_columnas_vehiculos",
        lambda: supabase.table("vehiculos").select("id,color,numero_motor").limit(1).execute(),
    )


def load_patentes(supabase: Any, tenant_id: str) -> set[str]:
    rows = fetch_paginated(
        "consulta_patentes",
        lambda: supabase.table("vehiculos").select("patente").eq("tenant_id", tenant_id),
    )
    return {patente for row in rows if (patente := normalizar_patente(row.get("patente")))}


def vehicle_payload(vehiculo: VehiculoImportable, tenant_id: str, cliente_id: str) -> dict[str, str]:
    return {
        "tenant_id": tenant_id,
        "cliente_id": cliente_id,
        "patente": vehiculo.patente,
        "marca": vehiculo.marca,
        "modelo": display_model(vehiculo),
        "fecha_patente": vehiculo.anio,
        "color": vehiculo.color,
        "numero_chasis": vehiculo.chasis,
        "numero_motor": vehiculo.motor,
    }


def insert_vehiculos_lote(supabase: Any, lote: list[VehiculoPendiente], tenant_id: str) -> None:
    execute_traced(
        f"insertar_vehiculos_lote_{lote[0].vehiculo.line_number}_{len(lote)}",
        lambda: supabase.table("vehiculos")
        .insert(
            [
                vehicle_payload(pending.vehiculo, tenant_id, pending.cliente_id)
                for pending in lote
            ],
            returning="minimal",
        )
        .execute(),
    )


def insert_vehiculos_con_aislamiento(
    supabase: Any,
    tenant_id: str,
    lote: list[VehiculoPendiente],
    errors: list[ErrorImportacion],
) -> list[VehiculoPendiente]:
    try:
        insert_vehiculos_lote(supabase, lote, tenant_id)
        return lote
    except Exception as error:
        if len(lote) > 1:
            midpoint = len(lote) // 2
            return insert_vehiculos_con_aislamiento(supabase, tenant_id, lote[:midpoint], errors) + insert_vehiculos_con_aislamiento(
                supabase, tenant_id, lote[midpoint:], errors
            )
        pending = lote[0]
        errors.append(ErrorImportacion("vehiculo", str(error), vehiculo=pending.row))
        logging.error("vehiculo linea %s: %s", pending.row.line_number, error)
        return []


def source_summary(error: ErrorImportacion) -> str:
    if error.cliente is not None:
        row = error.cliente
        values = (
            ("razon_social", row.razon_social),
            ("nombre_fantasia", row.nombre_fantasia),
            ("t_doc", row.tipo_documento),
            ("cuit", row.cuit),
            ("nro_documento", row.nro_documento),
            ("tel_fijo", row.telefono_fijo),
            ("celular", row.celular),
            ("calle", row.calle),
            ("numero", row.numero),
            ("piso", row.piso),
            ("depto", row.depto),
            ("cod_postal", row.codigo_postal),
            ("localidad", row.localidad),
            ("provincia", row.provincia),
            ("email", row.email),
        )
    elif error.vehiculo is not None:
        row = error.vehiculo
        values = (
            ("marca", row.marca),
            ("modelo", row.modelo),
            ("version", row.version),
            ("anio", row.anio),
            ("color", row.color),
            ("chasis", row.chasis),
            ("motor", row.motor),
        )
    else:
        return ""
    return " | ".join(f"{field}={value}" for field, value in values if value is not None)


def error_report_row(error: ErrorImportacion) -> dict[str, str]:
    client_code = ""
    vehicle_client_id = ""
    patente = ""
    line_number = ""
    if error.cliente is not None:
        line_number = str(error.cliente.line_number)
        client_code = normalizar_texto(error.cliente.codigo) or ""
    if error.vehiculo is not None:
        line_number = str(error.vehiculo.line_number)
        vehicle_client_id = normalizar_texto(error.vehiculo.id_cliente) or ""
        patente = normalizar_texto(error.vehiculo.patente) or ""
    return {
        "origen": error.origen,
        "linea_csv": line_number,
        "motivo": error.motivo,
        "codigo_cliente": client_code,
        "id_cliente_origen": vehicle_client_id,
        "patente": patente,
        "datos_origen": source_summary(error),
    }


def write_errors(error_path: Path, errors: list[ErrorImportacion]) -> None:
    error_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = error_path.with_name(f".{error_path.name}.{os.getpid()}.tmp")
    try:
        with temporary_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=ERROR_REPORT_FIELDS, delimiter=";")
            writer.writeheader()
            writer.writerows(error_report_row(error) for error in errors)
        os.replace(temporary_path, error_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def process_clientes(
    supabase: Any,
    tenant_id: str,
    rows: list[ClienteCsv],
    dry_run: bool,
    errors: list[ErrorImportacion],
    batch_size: int,
) -> tuple[dict[str, ClienteResuelto], int, int]:
    rows_by_code: dict[str, list[ClienteCsv]] = defaultdict(list)
    for row in rows:
        code = normalizar_codigo(row.codigo)
        if code is None:
            errors.append(ErrorImportacion("cliente", "el codigo es obligatorio", cliente=row))
        else:
            rows_by_code[code].append(row)

    duplicate_codes = {code for code, code_rows in rows_by_code.items() if len(code_rows) > 1}
    for code in duplicate_codes:
        for row in rows_by_code[code]:
            errors.append(ErrorImportacion("cliente", "el codigo se repite en el padron", cliente=row))

    candidatos: list[tuple[str, ClienteCsv, ClienteImportable]] = []
    for code, code_rows in rows_by_code.items():
        if code in duplicate_codes:
            continue
        row = code_rows[0]
        try:
            candidatos.append((code, row, classify_cliente(row)))
        except Exception as error:
            errors.append(ErrorImportacion("cliente", str(error), cliente=row))
            logging.error("cliente linea %s: %s", row.line_number, error)

    empresas = {
        cliente.identificacion
        for _, _, cliente in candidatos
        if cliente.tipo_cliente == "empresa" and cliente.identificacion is not None
    }
    particulares = {
        cliente.identificacion
        for _, _, cliente in candidatos
        if cliente.tipo_cliente == "particular" and cliente.identificacion is not None
    }
    empresas_existentes, empresas_duplicadas = load_clientes_existentes(
        supabase, tenant_id, "empresa", empresas, batch_size
    )
    particulares_existentes, particulares_duplicados = load_clientes_existentes(
        supabase, tenant_id, "particular", particulares, batch_size
    )

    client_map: dict[str, ClienteResuelto] = {}
    pendientes_por_identificacion: dict[tuple[str, str], ClientePendiente] = {}
    for code, row, cliente in candidatos:
        existentes = empresas_existentes if cliente.tipo_cliente == "empresa" else particulares_existentes
        duplicados = empresas_duplicadas if cliente.tipo_cliente == "empresa" else particulares_duplicados
        if cliente.identificacion is not None and cliente.identificacion in duplicados:
            errors.append(
                ErrorImportacion("cliente", "hay mas de un cliente existente con el mismo identificador", cliente=row)
            )
            logging.error("cliente linea %s: hay mas de un cliente existente con el mismo identificador", row.line_number)
            continue
        existing = existentes.get(cliente.identificacion) if cliente.identificacion is not None else None
        if existing is not None:
            client_map[code] = ClienteResuelto(existing, row.line_number)
            continue

        key = (
            cliente.tipo_cliente,
            cliente.identificacion if cliente.identificacion is not None else f"sin-documento:{code}",
        )
        pending = pendientes_por_identificacion.get(key)
        if pending is None:
            pending = ClientePendiente(str(uuid4()), cliente, [row])
            pendientes_por_identificacion[key] = pending
        else:
            pending.source_rows.append(row)

    pendientes = list(pendientes_por_identificacion.values())
    created = would_create = 0
    exitosos: list[ClientePendiente] = []
    logging.info(
        "fase=clientes_lotes: nuevos=%s tamano_lote=%s%s",
        len(pendientes),
        batch_size,
        " (dry-run)" if dry_run else "",
    )
    if dry_run:
        exitosos = pendientes
        would_create = len(pendientes)
    else:
        for lote in chunked(pendientes, batch_size):
            exitosos.extend(insert_clientes_con_aislamiento(supabase, tenant_id, lote, errors))
        created = len(exitosos)

    for pending in exitosos:
        for row in pending.source_rows:
            code = normalizar_codigo(row.codigo)
            assert code is not None
            client_map[code] = ClienteResuelto(None if dry_run else pending.cliente_id, row.line_number)
    return client_map, created, would_create


def process_vehiculos(
    supabase: Any,
    tenant_id: str,
    rows: Iterable[VehiculoCsv],
    client_map: dict[str, ClienteResuelto],
    known_patentes: set[str],
    dry_run: bool,
    errors: list[ErrorImportacion],
    progress_every: int,
    batch_size: int,
) -> tuple[int, int, int]:
    total = created = would_create = 0
    pendientes: list[VehiculoPendiente] = []
    for row in rows:
        total += 1
        if total == 1 or total % progress_every == 0:
            logging.info("fase=vehiculos_progreso: %s filas leidas", total)
        try:
            vehiculo = prepare_vehiculo(row)
        except ValueError as error:
            errors.append(ErrorImportacion("vehiculo", str(error), vehiculo=row))
            logging.error("vehiculo linea %s: %s", row.line_number, error)
            continue

        cliente = client_map.get(vehiculo.id_cliente)
        if cliente is None:
            errors.append(
                ErrorImportacion(
                    "vehiculo",
                    "Id Cliente no existe, es duplicado o no pudo importarse en el padron",
                    vehiculo=row,
                )
            )
            continue
        if vehiculo.patente in known_patentes:
            errors.append(
                ErrorImportacion(
                    "vehiculo",
                    "la patente ya existe en el tenant o se repite en el CSV",
                    vehiculo=row,
                )
            )
            continue

        known_patentes.add(vehiculo.patente)
        if dry_run:
            would_create += 1
            continue
        if cliente.cliente_id is None:
            errors.append(ErrorImportacion("vehiculo", "el cliente no tiene id para asignar el vehiculo", vehiculo=row))
            logging.error("vehiculo linea %s: el cliente no tiene id para asignar el vehiculo", vehiculo.line_number)
            continue
        pendientes.append(VehiculoPendiente(row, vehiculo, cliente.cliente_id))

    if dry_run:
        return total, created, would_create
    logging.info("fase=vehiculos_lotes: nuevos=%s tamano_lote=%s", len(pendientes), batch_size)
    for lote in chunked(pendientes, batch_size):
        created += len(insert_vehiculos_con_aislamiento(supabase, tenant_id, lote, errors))
    return total, created, would_create


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Importa clientes y vehiculos vinculados por Codigo e Id Cliente."
    )
    parser.add_argument("clientes_csv", type=Path, help="Ruta del padron de clientes")
    parser.add_argument("vehiculos_csv", type=Path, help="Ruta del padron de vehiculos")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida y consulta referencias sin insertar datos; genera errores.txt",
    )
    parser.add_argument(
        "--errores-path",
        type=Path,
        help="Ruta del reporte de errores (por defecto: errores.txt junto al CSV de vehiculos)",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_integer,
        default=DEFAULT_BATCH_SIZE,
        metavar="N",
        help="Cantidad maxima de filas por insert a Supabase (por defecto: 250)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Muestra fases tecnicas, sin imprimir datos personales ni credenciales",
    )
    parser.add_argument(
        "--progress-every",
        type=positive_integer,
        default=100,
        metavar="N",
        help="Informa avance cada N vehiculos procesados (por defecto: 100)",
    )
    parser.add_argument(
        "--request-timeout",
        type=positive_integer,
        default=15,
        metavar="SEGUNDOS",
        help="Tiempo maximo por llamada HTTP a Supabase (por defecto: 15)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )
    if not args.clientes_csv.is_file():
        raise FileNotFoundError(f"no existe el CSV de clientes: {args.clientes_csv}")
    if not args.vehiculos_csv.is_file():
        raise FileNotFoundError(f"no existe el CSV de vehiculos: {args.vehiculos_csv}")

    tenant_id = validate_tenant_id()
    error_path = args.errores_path or args.vehiculos_csv.with_name("errores.txt")
    errors: list[ErrorImportacion] = []
    logging.info("fase=inicio%s", " (dry-run)" if args.dry_run else "")

    try:
        supabase = create_supabase_client(args.request_timeout)
        tenant_response = execute_traced(
            "validacion_tenant",
            lambda: supabase.table("tenants").select("id").eq("id", tenant_id).limit(1).execute(),
        )
        if not tenant_response.data:
            raise ValueError("TENANT_ID no corresponde a un tenant existente")
        verify_vehicle_columns(supabase)
        client_rows = list(read_clientes_csv(args.clientes_csv))
        client_map, created_clients, would_create_clients = process_clientes(
            supabase, tenant_id, client_rows, args.dry_run, errors, args.batch_size
        )
        known_patentes = load_patentes(supabase, tenant_id)
        total_vehicles, created_vehicles, would_create_vehicles = process_vehiculos(
            supabase,
            tenant_id,
            read_vehiculos_csv(args.vehiculos_csv),
            client_map,
            known_patentes,
            args.dry_run,
            errors,
            args.progress_every,
            args.batch_size,
        )
    except Exception as error:
        errors.append(ErrorImportacion("sistema", str(error)))
        write_errors(error_path, errors)
        logging.error("la importacion no pudo continuar: %s", error)
        return 1

    write_errors(error_path, errors)
    logging.info(
        "finalizado: clientes_creados=%s clientes_a_crear=%s vehiculos_procesados=%s "
        "vehiculos_creados=%s vehiculos_a_crear=%s errores=%s reporte_errores=%s%s",
        created_clients,
        would_create_clients,
        total_vehicles,
        created_vehicles,
        would_create_vehicles,
        len(errors),
        error_path,
        " (dry-run)" if args.dry_run else "",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, RuntimeError, ValueError) as error:
        logging.basicConfig(level=logging.ERROR, format="%(levelname)s: %(message)s")
        logging.error(error)
        raise SystemExit(1) from error
