#!/usr/bin/env python3
"""Importa clientes de un CSV a un tenant fijo de B2Car.

Uso:
    # PowerShell
    $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
    python scripts/importar_clientes_tenant.py clientes.csv --dry-run
    python scripts/importar_clientes_tenant.py clientes.csv

Instalación:
    python -m pip install -r scripts/requirements-importar-clientes.txt

El CSV debe estar separado por punto y coma e incluir los encabezados:
    Nombre;Número de identificación;Domicilio;Mail;Teléfono;Domicilio

Se acepta que ``Domicilio`` se repita: se usa el primer valor no vacío.
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Callable, Iterable, TypeVar
from uuid import UUID


# Reemplazar antes de ejecutar. No se recibe por argumento para evitar importar
# accidentalmente datos en otro tenant.
TENANT_ID = "3b07dec7-0da6-42a3-9435-4190cc19eb8a"

COMPANY_CUIT_PREFIXES = {"30", "33", "34"}
T = TypeVar("T")


@dataclass(frozen=True)
class ClienteCsv:
    line_number: int
    nombre: str | None
    identificacion: str | None
    domicilio: str | None
    mail: str | None
    telefono: str | None


@dataclass(frozen=True)
class ClienteImportable:
    line_number: int
    tipo_cliente: str
    nombre: str
    apellido: str | None
    identificacion: str | None
    domicilio: str | None
    mail: str | None
    telefono: str | None


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
    return re.sub(r"\s+", " ", without_accents.strip().casefold())


def normalizar_identificacion(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    digits = re.sub(r"\D", "", text)
    if not digits:
        raise ValueError("el número de identificación no contiene dígitos")
    return digits


def cuit_es_valido(cuit: str) -> bool:
    if len(cuit) != 11 or not cuit.isdigit():
        return False

    weights = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    remainder = sum(int(digit) * weight for digit, weight in zip(cuit[:10], weights)) % 11
    check_digit = 11 - remainder
    if check_digit == 11:
        check_digit = 0
    elif check_digit == 10:
        check_digit = 9
    return check_digit == int(cuit[-1])


def es_cuit_de_empresa(identificacion: str | None) -> bool:
    return bool(
        identificacion
        and len(identificacion) == 11
        and identificacion[:2] in COMPANY_CUIT_PREFIXES
    )


def separar_nombre_particular(nombre_completo: str) -> tuple[str, str]:
    parts = nombre_completo.rsplit(" ", maxsplit=1)
    nombre = parts[0]
    # particulares.apellido es NOT NULL en el esquema. Una cadena vacía expresa
    # que el CSV no lo aportó, sin inventar un dato personal.
    apellido = parts[1] if len(parts) == 2 else ""
    return nombre, apellido


def clasificar_cliente(row: ClienteCsv) -> ClienteImportable:
    if row.nombre is None:
        raise ValueError("el nombre es obligatorio")

    identificacion = normalizar_identificacion(row.identificacion)

    if es_cuit_de_empresa(identificacion):
        if not cuit_es_valido(identificacion):
            raise ValueError("el CUIT empresarial no supera la validación de dígito verificador")
        return ClienteImportable(
            line_number=row.line_number,
            tipo_cliente="empresa",
            nombre=row.nombre,
            apellido=None,
            identificacion=identificacion,
            domicilio=row.domicilio,
            mail=row.mail,
            telefono=row.telefono,
        )

    nombre, apellido = separar_nombre_particular(row.nombre)

    return ClienteImportable(
        line_number=row.line_number,
        tipo_cliente="particular",
        nombre=nombre,
        apellido=apellido,
        identificacion=identificacion,
        domicilio=row.domicilio,
        mail=row.mail,
        telefono=row.telefono,
    )


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


def read_csv(csv_path: Path) -> Iterable[ClienteCsv]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file, delimiter=";")
        try:
            headers = next(reader)
        except StopIteration as error:
            raise ValueError("el CSV está vacío") from error

        nombre_positions = positions_for_headers(headers, {"nombre"})
        identificacion_positions = positions_for_headers(
            headers,
            {
                "numero de identificacion",
                "nro de identificacion",
                "numero identificacion",
                "identificacion",
            },
        )
        domicilio_positions = positions_for_headers(headers, {"domicilio", "direccion"})
        mail_positions = positions_for_headers(headers, {"mail", "email", "correo"})
        telefono_positions = positions_for_headers(headers, {"telefono", "celular"})

        if not nombre_positions or not identificacion_positions:
            raise ValueError(
                "el CSV requiere los encabezados 'Nombre' y 'Número de identificación'"
            )

        for line_number, values in enumerate(reader, start=2):
            if not any(normalizar_texto(value) for value in values):
                continue

            yield ClienteCsv(
                line_number=line_number,
                nombre=first_value(values, nombre_positions),
                identificacion=first_value(values, identificacion_positions),
                domicilio=first_value(values, domicilio_positions),
                mail=first_value(values, mail_positions),
                telefono=first_value(values, telefono_positions),
            )


def validate_tenant_id() -> str:
    try:
        return str(UUID(TENANT_ID))
    except ValueError as error:
        raise ValueError("configurá TENANT_ID con un UUID válido antes de ejecutar") from error


def non_negative_integer(value: str) -> int:
    try:
        result = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("debe ser un número entero") from error

    if result < 0:
        raise argparse.ArgumentTypeError("debe ser mayor o igual a cero")
    return result


def positive_integer(value: str) -> int:
    result = non_negative_integer(value)
    if result == 0:
        raise argparse.ArgumentTypeError("debe ser mayor que cero")
    return result


def execute_traced(phase: str, operation: Callable[[], T]) -> T:
    started_at = perf_counter()
    logging.debug("fase=%s inicio", phase)
    try:
        result = operation()
    except Exception:
        logging.debug("fase=%s falló en %.2fs", phase, perf_counter() - started_at)
        raise
    logging.debug("fase=%s completada en %.2fs", phase, perf_counter() - started_at)
    return result


def create_supabase_client(request_timeout: int):
    supabase_url = "https://izczuohetsocgrcjupgy.supabase.co"
    service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Y3p1b2hldHNvY2dyY2p1cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NzgyNTYsImV4cCI6MjA3NDE1NDI1Nn0.YXBPIhfOAqJ4mLzUCC_CDD5ItlZKrRbuWPlBTSvbWDI"
    if not supabase_url:
        raise RuntimeError("falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL en las variables de entorno")
    if not service_role_key:
        raise RuntimeError("falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno")

    try:
        from supabase import create_client
        from supabase.client import ClientOptions
    except ImportError as error:
        raise RuntimeError(
            "falta la dependencia supabase. Instalá: "
            "pip install -r scripts/requirements-importar-clientes.txt"
        ) from error

    logging.info("fase=cliente_supabase: iniciando (límite HTTP: %ss)", request_timeout)
    return execute_traced(
        "cliente_supabase",
        lambda: create_client(
            supabase_url,
            service_role_key,
            options=ClientOptions(postgrest_client_timeout=request_timeout, schema="public"),
        ),
    )


def cliente_ya_existe(supabase, tenant_id: str, cliente: ClienteImportable) -> bool:
    if cliente.tipo_cliente != "empresa" or cliente.identificacion is None:
        return False

    response = execute_traced(
        f"línea_{cliente.line_number}_consulta_duplicado",
        lambda: (
            supabase.table("empresas")
            .select("id, clientes!inner(tenant_id)")
            .eq("cuit", cliente.identificacion)
            .eq("clientes.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ),
    )
    return bool(response.data)


def insert_cliente(supabase, tenant_id: str, cliente: ClienteImportable) -> None:
    cliente_response = execute_traced(
        f"línea_{cliente.line_number}_insertar_cliente",
        lambda: (
            supabase.table("clientes")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "tipo_cliente": cliente.tipo_cliente,
                }
            )
            .select("id")
            .execute()
        ),
    )
    if not cliente_response.data or not cliente_response.data[0].get("id"):
        raise RuntimeError("Supabase no devolvió el id del cliente creado")
    cliente_id = cliente_response.data[0]["id"]

    try:
        if cliente.tipo_cliente == "empresa":
            if cliente.identificacion is None:
                raise RuntimeError("la empresa no tiene CUIT para guardar en empresas.cuit")
            execute_traced(
                f"línea_{cliente.line_number}_insertar_empresa",
                lambda: supabase.table("empresas")
                .insert(
                    {
                        "id": cliente_id,
                        "nombre": cliente.nombre,
                        "cuit": cliente.identificacion,
                        "direccion": cliente.domicilio,
                        "email": cliente.mail,
                        "telefono": cliente.telefono,
                    }
                )
                .execute(),
            )
            return

        execute_traced(
            f"línea_{cliente.line_number}_insertar_particular",
            lambda: supabase.table("particulares")
            .insert(
                {
                    "id": cliente_id,
                    "nombre": cliente.nombre,
                    "apellido": cliente.apellido,
                    "direccion": cliente.domicilio,
                    "email": cliente.mail,
                    "telefono": cliente.telefono,
                }
            )
            .execute(),
        )
    except Exception as insert_error:
        try:
            execute_traced(
                f"línea_{cliente.line_number}_revertir_cliente",
                lambda: supabase.table("clientes").delete().eq("id", cliente_id).execute(),
            )
        except Exception as rollback_error:
            raise RuntimeError(
                "falló la creación del detalle y no se pudo revertir el cliente base"
            ) from rollback_error
        raise insert_error


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa clientes desde un CSV separado por punto y coma.")
    parser.add_argument("csv_path", type=Path, help="Ruta del archivo CSV a importar")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida y clasifica el CSV sin insertar datos",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Muestra cada fase y consulta, sin imprimir datos personales ni credenciales",
    )
    parser.add_argument(
        "--progress-every",
        type=positive_integer,
        default=100,
        metavar="N",
        help="Informa avance cada N filas procesadas (por defecto: 100)",
    )
    parser.add_argument(
        "--request-timeout",
        "--connect-timeout",
        dest="request_timeout",
        type=positive_integer,
        default=15,
        metavar="SEGUNDOS",
        help=(
            "Tiempo máximo por llamada HTTP a Supabase (por defecto: 15). "
            "--connect-timeout se conserva como alias."
        ),
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )
    tenant_id = validate_tenant_id()
    if not args.csv_path.is_file():
        raise FileNotFoundError(f"no existe el CSV: {args.csv_path}")

    total = created = skipped = errors = valid = 0
    logging.info("fase=inicio: CSV=%s%s", args.csv_path, " (dry-run)" if args.dry_run else "")
    supabase = None if args.dry_run else create_supabase_client(args.request_timeout)

    if supabase:
        logging.info("fase=validación_tenant: iniciando")
        tenant_response = execute_traced(
            "validación_tenant",
            lambda: supabase.table("tenants").select("id").eq("id", tenant_id).limit(1).execute(),
        )
        if not tenant_response.data:
            raise ValueError("TENANT_ID no corresponde a un tenant existente")
        logging.info("fase=validación_tenant: completada")

    logging.info("fase=lectura_csv: iniciando")
    for row in read_csv(args.csv_path):
        total += 1
        if total == 1 or total % args.progress_every == 0:
            logging.info("fase=progreso: %s filas leídas", total)
        try:
            logging.debug("línea %s: clasificando", row.line_number)
            cliente = clasificar_cliente(row)
            if args.dry_run:
                valid += 1
                logging.debug("línea %s: %s válida", row.line_number, cliente.tipo_cliente)
                continue

            assert supabase is not None
            if cliente.tipo_cliente == "particular" and cliente.identificacion:
                logging.warning(
                    "línea %s: el DNI/CUIL se usa para clasificar, pero el esquema actual no tiene dónde guardarlo",
                    row.line_number,
                )
            if cliente_ya_existe(supabase, tenant_id, cliente):
                skipped += 1
                logging.warning("línea %s: omitida por CUIT empresarial ya existente", row.line_number)
                continue
            insert_cliente(supabase, tenant_id, cliente)
            created += 1
        except Exception as error:
            errors += 1
            if args.verbose:
                logging.exception("línea %s: %s", row.line_number, error)
            else:
                logging.error("línea %s: %s", row.line_number, error)

    logging.info(
        "finalizado: procesados=%s creados=%s válidos=%s omitidos=%s errores=%s%s",
        total,
        created,
        valid,
        skipped,
        errors,
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
