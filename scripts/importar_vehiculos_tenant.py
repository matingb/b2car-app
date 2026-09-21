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
from uuid import UUID


# Debe coincidir con el importador de clientes asociado a esta migracion.
# No se recibe por argumento para evitar importar accidentalmente otro tenant.
# ID del tenant: 11111111-1111-1111-1111-111111111111
TENANT_ID = "11111111-1111-1111-1111-111111111111"
#TENANT_ID = "3b07dec7-0da6-42a3-9435-4190cc19eb8a"
COMPANY_CUIT_PREFIXES = {"30", "33", "34"}
PERSON_CUIL_PREFIXES = {"20", "23", "24", "27"}
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
    identificacion: str
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

    tax_id = normalizar_identificacion(row.cuit)
    document = normalizar_identificacion(row.nro_documento)
    type_label = normalizar_encabezado(row.tipo_documento or "")

    if tax_id is not None:
        if len(tax_id) != 11 or not identificacion_11_es_valida(tax_id):
            raise ValueError("el CUIT/CUIL debe tener 11 digitos y un digito verificador valido")
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
        raise ValueError("el CUIT/CUIL tiene un prefijo que no permite clasificarlo como empresa o particular")

    if not is_dni(document):
        raise ValueError("falta un CUIT/CUIL valido o un DNI de 7 u 8 digitos")
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


def relation_object(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        if len(value) > 1:
            raise RuntimeError("un cliente tiene mas de un registro base asociado")
        return value[0] if value else None
    if value is None:
        return None
    raise RuntimeError("Supabase devolvio una relacion de cliente inesperada")


def find_existing_cliente(supabase: Any, tenant_id: str, cliente: ClienteImportable) -> str | None:
    table = "empresas" if cliente.tipo_cliente == "empresa" else "particulares"
    field = "cuit" if cliente.tipo_cliente == "empresa" else "dni_cuil"
    response = execute_traced(
        f"linea_{cliente.line_number}_buscar_cliente_existente",
        lambda: supabase.table(table).select("id,clientes(tenant_id)").eq(field, cliente.identificacion).limit(2).execute(),
    )
    rows = response.data or []
    if not rows:
        return None
    if len(rows) > 1:
        raise RuntimeError("hay mas de un cliente existente con el mismo identificador")
    client_id = rows[0].get("id")
    base_client = relation_object(rows[0].get("clientes"))
    if not isinstance(client_id, str) or base_client is None:
        raise RuntimeError("el cliente existente no tiene una relacion base valida")
    if base_client.get("tenant_id") != tenant_id:
        raise ValueError("el identificador ya existe en otro tenant")
    return client_id


def insert_cliente(supabase: Any, tenant_id: str, cliente: ClienteImportable) -> str:
    response = execute_traced(
        f"linea_{cliente.line_number}_insertar_cliente_base",
        lambda: supabase.table("clientes")
        .insert({"tenant_id": tenant_id, "tipo_cliente": cliente.tipo_cliente})
        .select("id")
        .execute(),
    )
    if not response.data or not isinstance(response.data[0].get("id"), str):
        raise RuntimeError("Supabase no devolvio el id del cliente creado")
    client_id = response.data[0]["id"]
    try:
        if cliente.tipo_cliente == "empresa":
            execute_traced(
                f"linea_{cliente.line_number}_insertar_empresa",
                lambda: supabase.table("empresas")
                .insert(
                    {
                        "id": client_id,
                        "nombre": cliente.nombre,
                        "cuit": cliente.identificacion,
                        "direccion": cliente.direccion,
                        "email": cliente.email,
                        "telefono": cliente.telefono,
                    }
                )
                .execute(),
            )
        else:
            execute_traced(
                f"linea_{cliente.line_number}_insertar_particular",
                lambda: supabase.table("particulares")
                .insert(
                    {
                        "id": client_id,
                        "nombre": cliente.nombre,
                        "apellido": cliente.apellido,
                        "dni_cuil": cliente.identificacion,
                        "direccion": cliente.direccion,
                        "email": cliente.email,
                        "telefono": cliente.telefono,
                    }
                )
                .execute(),
            )
        return client_id
    except Exception as insert_error:
        try:
            execute_traced(
                f"linea_{cliente.line_number}_revertir_cliente_base",
                lambda: supabase.table("clientes").delete().eq("id", client_id).execute(),
            )
        except Exception as rollback_error:
            raise RuntimeError("fallo el detalle y no se pudo revertir el cliente base") from rollback_error
        raise insert_error


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


def insert_vehiculo(supabase: Any, vehiculo: VehiculoImportable, tenant_id: str, cliente_id: str) -> None:
    execute_traced(
        f"linea_{vehiculo.line_number}_insertar_vehiculo",
        lambda: supabase.table("vehiculos").insert(vehicle_payload(vehiculo, tenant_id, cliente_id)).execute(),
    )


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

    client_map: dict[str, ClienteResuelto] = {}
    created = would_create = 0
    for code, code_rows in rows_by_code.items():
        if code in duplicate_codes:
            continue
        row = code_rows[0]
        try:
            cliente = classify_cliente(row)
            existing_id = find_existing_cliente(supabase, tenant_id, cliente)
            if existing_id is not None:
                client_map[code] = ClienteResuelto(existing_id, row.line_number)
                continue
            if dry_run:
                client_map[code] = ClienteResuelto(None, row.line_number)
                would_create += 1
                continue
            client_map[code] = ClienteResuelto(insert_cliente(supabase, tenant_id, cliente), row.line_number)
            created += 1
        except Exception as error:
            errors.append(ErrorImportacion("cliente", str(error), cliente=row))
            logging.error("cliente linea %s: %s", row.line_number, error)
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
) -> tuple[int, int, int]:
    total = created = would_create = 0
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
        try:
            if cliente.cliente_id is None:
                raise RuntimeError("el cliente no tiene id para asignar el vehiculo")
            insert_vehiculo(supabase, vehiculo, tenant_id, cliente.cliente_id)
            created += 1
        except Exception as error:
            errors.append(ErrorImportacion("vehiculo", str(error), vehiculo=row))
            logging.error("vehiculo linea %s: %s", vehiculo.line_number, error)
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
        help="Valida y consulta referencias sin insertar datos; igualmente genera errores.txt",
    )
    parser.add_argument(
        "--errores-path",
        type=Path,
        help="Ruta del reporte de errores (por defecto: errores.txt junto al CSV de vehiculos)",
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
            supabase, tenant_id, client_rows, args.dry_run, errors
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
        )
    except Exception as error:
        errors.append(ErrorImportacion("sistema", str(error)))
        write_errors(error_path, errors)
        logging.error("la importacion no pudo continuar: %s", error)
        return 1

    write_errors(error_path, errors)
    logging.info(
        "finalizado: clientes_creados=%s clientes_a_crear=%s vehiculos_procesados=%s "
        "vehiculos_creados=%s vehiculos_a_crear=%s errores=%s reporte=%s%s",
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
