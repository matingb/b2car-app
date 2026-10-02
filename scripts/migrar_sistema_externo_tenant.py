#!/usr/bin/env python3
"""Migra clientes, vehiculos, operarios, ordenes de trabajo, tareas y repuestos
desde los CSV exportados por un sistema externo hacia un tenant y un taller de
B2Car.

Uso:
    # PowerShell
    $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
    python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188 --dry-run
    python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188

    # Repuestos como lineas de mano de obra, sin crear productos:
    python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188 --repuestos detalle

Instalacion:
    python -m pip install -r scripts/requirements-importar-clientes.txt

Archivos esperados en el directorio (sin distinguir mayusculas y minusculas):
    clientes.csv, vehiculos.csv, operarios.csv, ordenesTrabajo.csv, tareasEnOT.csv
    y repuestosEnOT.csv

Antes de ejecutar:
    1. Configurar TENANT_ID y TALLER_ID con UUIDs validos (los valores
       commiteados son placeholders que impiden una ejecucion accidental).
    2. Aplicar en la base destino la migracion
       20260930120000_b2c_188_snapshot_costo_service_role.sql.

Los IDs del sistema anterior solo se usan como claves de cruce. El archivo de
estado (``migracion_estado_<TENANT_ID>.json``) guarda el mapa ID origen -> ID
B2Car para que una re-ejecucion no duplique registros. El reporte
(``reporte_migracion.csv``) lista cada error y warning con archivo, linea e ID
de origen, sin datos personales.

El mapeo completo, las decisiones y el procedimiento de ejecucion y
recuperacion estan en docs/migracion-sistema-externo.md.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from time import perf_counter
from typing import Any, Callable, Iterable, NamedTuple, TypeVar
from uuid import UUID, uuid4, uuid5


# No se reciben por argumento para evitar migrar accidentalmente otro tenant.
# Los placeholders commiteados no son UUIDs: validate_config() rechaza la
# ejecucion hasta que se configuren los valores reales.
TENANT_ID = "11111111-1111-1111-1111-111111111111"
TALLER_ID = "50000000-0000-0000-0000-000000000001"
# Etiqueta guardada en arreglos.extra_data.migracion.origen y en el estado.
ORIGEN_MIGRACION = "sistema-externo"

ESTADO_VERSION = 1
DEFAULT_BATCH_SIZE = 500
# UUIDs por filtro in_: mantiene las URLs de PostgREST por debajo del limite.
LOOKUP_CHUNK_SIZE = 200
# Igual al default de src/lib/ivaRate.ts; alinearlo si produccion define IVA_RATE.
IVA_RATE = Decimal("0.21")
# Los importes de tareas y repuestos del sistema anterior son netos y su Total
# de la OT es (tareas + repuestos) x 1,21. En B2Car las lineas incluyen IVA, asi
# que los importes de venta se llevan a final con esta alicuota.
IVA_ORIGEN = Decimal("0.21")
# Argentina no aplica horario de verano desde 2009. timezone fijo evita
# depender de tzdata en Windows.
ZONA_HORARIA_ORIGEN = timezone(timedelta(hours=-3))
TOLERANCIA_REDONDEO = Decimal("0.50")
DESCRIPCION_AJUSTE_TOTAL = "Diferencia con el total de la OT del sistema anterior"
# Igual a ARREGLO_DESCRIPCION_FALLBACK de src/lib/arreglos.ts.
DESCRIPCION_ARREGLO_FALLBACK = "Arreglo registrado sin detalle específico"
DESCRIPCION_TAREA_FALLBACK = "Tarea sin descripción"
MIGRACION_REQUERIDA = "20260930120000_b2c_188_snapshot_costo_service_role"
# Solo los repuestos en este estado forman parte del Total de la OT.
ESTADO_REPUESTO_IMPORTADO = "utilizado"
# --repuestos: "productos" crea productos y stock y los asigna al arreglo;
# "detalle" los agrega como lineas de mano de obra, sin crear productos.
MODO_REPUESTOS_PRODUCTOS = "productos"
MODO_REPUESTOS_DETALLE = "detalle"
MODOS_REPUESTOS = (MODO_REPUESTOS_PRODUCTOS, MODO_REPUESTOS_DETALLE)
# Codigo de los productos que el sistema anterior no codifico: MIG-<IdRepuesto>.
PREFIJO_CODIGO_GENERADO = "MIG-"
# La operacion de asignacion de cada arreglo deriva de su ID: una re-ejecucion
# puede borrarla aunque el corte haya ocurrido antes de vincularla al arreglo.
NAMESPACE_OPERACION_ARREGLO = UUID("5c1f0f5e-8f0b-4a51-9a3e-0b7d2f6c9a41")

CENTAVOS = Decimal("0.01")
MAX_HORAS = Decimal("9999.99")
MAX_PRECIO = Decimal("9999999999.99")
MAX_ENTERO = 2_147_483_647
COMPANY_CUIT_PREFIXES = {"30", "33", "34"}
PERSON_CUIL_PREFIXES = {"20", "23", "24", "27"}
PREFIJO_DNI_FICTICIO = "99"
DNI_FICTICIO_MIN = 99_000_000
DNI_FICTICIO_MAX = 99_999_999
ID_OPERARIO_MAX_DERIVABLE = 1_000_000
# Autos (AAA999, AA999AA) y motos (999AAA, A999AAA).
PATENTE_FORMATOS = (
    re.compile(r"^[A-Z]{3}[0-9]{3}$"),
    re.compile(r"^[A-Z]{2}[0-9]{3}[A-Z]{2}$"),
    re.compile(r"^[0-9]{3}[A-Z]{3}$"),
    re.compile(r"^[A-Z][0-9]{3}[A-Z]{3}$"),
)
DELIMITADORES = (";", ",", "\t", "|")
VALORES_NULOS = {"null", "\\n"}
FORMATOS_FECHA = (
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
)
T = TypeVar("T")

ARCHIVOS = {
    "cliente": "clientes.csv",
    "vehiculo": "vehiculos.csv",
    "operario": "operarios.csv",
    "orden": "ordenesTrabajo.csv",
    "tarea": "tareasEnOT.csv",
    "repuesto": "repuestosEnOT.csv",
}
ARCHIVO_POR_ENTIDAD = {**ARCHIVOS, "categoria": ARCHIVOS["tarea"], "producto": ARCHIVOS["repuesto"]}
ENTIDADES = ("cliente", "vehiculo", "operario", "categoria", "producto", "orden", "tarea", "repuesto")
CONTADORES = (
    "lineas_ajuste_total",
    "ots_centavos_de_redondeo_absorbidos",
    "ots_total_menor_que_tareas",
    "ots_vehiculo_por_id_vehiculo",
    "ots_vehiculo_preexistente",
    "ots_cliente_distinto_vehiculo",
    "ots_kilometraje_desde_tareas",
    "tareas_sin_operario_en_origen",
    "tareas_operario_no_resuelto",
    "tareas_sin_importe_venta",
    "tareas_costo_desconocido",
    "repuestos_no_utilizados",
    "repuestos_cantidad_fraccionaria",
    "repuestos_sin_importe_venta",
    "repuestos_agrupados",
    "repuestos_costo_desde_precio",
    "productos_codigo_generado",
    "productos_costo_desde_precio",
    "stocks_creados",
    "categorias_creadas",
    "vehiculos_sin_marca",
    "vehiculos_patente_no_estandar",
    "operarios_dni_ficticio",
    "operarios_sin_apellido",
)
REPORTE_CAMPOS = (
    "nivel",
    "codigo",
    "entidad",
    "archivo",
    "linea_csv",
    "id_origen",
    "referencias",
    "motivo",
)
SECCIONES_ESTADO = ("clientes", "vehiculos", "operarios", "categorias", "productos", "ordenes")

# Encabezados ya normalizados con normalizar_encabezado().
CLIENTES_REQUERIDAS = {
    "id_cliente": {"idcliente", "id cliente"},
    "razon_social": {"razon social", "razonsocial"},
    "nro_cuit": {"nro cuit", "nrocuit", "cuit"},
    "nro_documento": {"nrodocumento", "nro documento", "numero documento"},
}
CLIENTES_OPCIONALES = {
    "nombre_fantasia": {"nombrefantasia", "nombre fantasia"},
    "calle": {"calle"},
    "calle_nro": {"calle nro", "callenro"},
    "piso": {"piso"},
    "depto": {"depto", "departamento", "dpto"},
    "localidad": {"localidad"},
    "provincia": {"provincia"},
    "email": {"direccionemail", "direccion email", "email", "mail"},
    "telefono_movil": {"telefono movil", "telefonomovil", "celular"},
    "telefono_fijo": {"telefono fijo", "telefonofijo", "telefono"},
}
VEHICULOS_REQUERIDAS = {
    "patente": {"patente"},
    "marca": {"marca"},
    "modelo": {"modelo"},
    "version": {"version"},
    "anio": {"anio", "ano"},
    "color": {"color"},
    "id_cliente": {"idcliente", "id cliente", "id_cliente"},
    "chasis": {"chasis", "numero chasis", "nro chasis"},
    "motor": {"motor", "numero motor", "nro motor"},
}
OPERARIOS_REQUERIDAS = {
    "id_operario": {"idoperario", "id operario"},
    "nombre": {"nombre"},
    "importe_hora_costo": {"importehoracosto", "importe hora costo"},
}
OPERARIOS_OPCIONALES = {
    "telefono": {"telefono"},
    "dni": {"dni", "nro documento", "nrodocumento", "numero documento", "documento"},
}
ORDENES_REQUERIDAS = {
    "id_ot": {"idot", "id ot"},
    "patente": {"patente"},
    "id_vehiculo": {"idvehiculo", "id vehiculo"},
    "id_cliente": {"idcliente", "id cliente"},
    "fecha_ingreso": {"fechaingreso s", "fechaingreso", "fecha ingreso"},
    "kilometraje": {"kilometraje"},
    "total": {"total"},
}
ORDENES_OPCIONALES = {
    "solicitud_cliente": {"solicitudcliente", "solicitud cliente"},
    "mano_obra": {"manoobra", "mano obra"},
    "ampliacion": {"ampliacion"},
    "otros": {"otros"},
    "ref_a_cliente": {"refacliente", "ref a cliente"},
    "facturado": {"facturado"},
    "id_factura": {"idfactura", "id factura"},
    "id_cliente_factura": {"idclientefactura", "id cliente factura"},
    "importe_a_facturar": {"importeafacturar", "importe a facturar"},
    "id_deposito": {"iddeposito", "id deposito"},
    "id_tipo_vehiculo": {"idtipovehiculo", "id tipo vehiculo"},
    "id_marca": {"idmarca", "id marca"},
    "id_modelo": {"idmodelo", "id modelo"},
    "version": {"version"},
    "anio": {"anio", "ano"},
}
TAREAS_REQUERIDAS = {
    "id_tarea": {"idtareaenot", "id tarea en ot"},
    "id_ot": {"idot", "id ot"},
    "descripcion": {"descripciontarea", "descripcion tarea"},
    "cant_horas_venta": {"canthorasventa", "cant horas venta"},
    "precio_hora_venta": {"preciohoraventa", "precio hora venta"},
    "importe_horas_venta": {"importehorasventa", "importe horas venta"},
    "cant_horas_costo": {"canthorascosto", "cant horas costo"},
    "precio_hora_costo": {"preciohoracosto", "precio hora costo"},
    "importe_costo": {"importecosto", "importe costo"},
    "id_operario": {"idoperario", "id operario"},
    "grupo_tarea": {"grupotarea", "grupo tarea"},
    "fecha_realizado": {"fecharealizado s", "fecharealizado", "fecha realizado"},
}
TAREAS_OPCIONALES = {
    "kilometraje": {"kilometraje"},
}
REPUESTOS_REQUERIDAS = {
    "id_ot": {"idot", "id ot"},
    "id_renglon": {"idrenglon", "id renglon"},
    "id_repuesto": {"idrepuesto", "id repuesto"},
    "descripcion": {"descripcion"},
    "cantidad": {"cantidad"},
    "estado": {"estado"},
    "precio_total": {"preciototal", "precio total"},
    "costo_real": {"costoreal", "costo real"},
    "codigo": {"codigo"},
}

# Columnas que el script escribe o lee; se validan antes de migrar.
COLUMNAS_VERIFICADAS = {
    "detalle_arreglo": "id,valor_hora_empleado,horas_facturadas,horas_trabajadas,precio_hora_facturada",
    "productos": "id,codigo,nombre,precio_unitario,costo_unitario,show_in_stock",
    "stocks": "id,taller_id,producto_id,cantidad,stock_minimo,stock_maximo",
    "operaciones": "id,tipo,taller_id,fecha",
    "operaciones_asignacion_arreglo": "operacion_id,arreglo_id",
    "operaciones_lineas": "id,operacion_id,stock_id,cantidad,monto_unitario,delta_cantidad",
    "empleados": "id,valor_hora,dni,taller_id",
    "particulares": "id,tenant_id,dni_cuil",
    "empresas": "id,tenant_id,cuit",
    "vehiculos": "id,color,numero_motor",
    "arreglos": "id,total_cobrado,es_facturable,extra_data",
    "categorias_arreglo": "id,nombre",
}


class ErrorFatal(RuntimeError):
    """Detiene la migracion: configuracion, esquema, estado o compensacion."""


class RegistroInvalido(ValueError):
    """El registro de origen no se puede importar."""

    def __init__(self, codigo: str, motivo: str) -> None:
        super().__init__(motivo)
        self.codigo = codigo
        self.motivo = motivo


class Aviso(NamedTuple):
    codigo: str
    motivo: str


# --------------------------------------------------------------------------
# Filas de origen
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ClienteCsv:
    line_number: int
    id_cliente: str | None
    razon_social: str | None
    nro_cuit: str | None
    nro_documento: str | None
    nombre_fantasia: str | None = None
    calle: str | None = None
    calle_nro: str | None = None
    piso: str | None = None
    depto: str | None = None
    localidad: str | None = None
    provincia: str | None = None
    email: str | None = None
    telefono_movil: str | None = None
    telefono_fijo: str | None = None


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
class OperarioCsv:
    line_number: int
    id_operario: str | None
    nombre: str | None
    importe_hora_costo: str | None
    telefono: str | None = None
    dni: str | None = None


@dataclass(frozen=True)
class OrdenCsv:
    line_number: int
    id_ot: str | None
    patente: str | None
    id_vehiculo: str | None
    id_cliente: str | None
    fecha_ingreso: str | None
    kilometraje: str | None
    total: str | None
    solicitud_cliente: str | None = None
    mano_obra: str | None = None
    ampliacion: str | None = None
    otros: str | None = None
    ref_a_cliente: str | None = None
    facturado: str | None = None
    id_factura: str | None = None
    id_cliente_factura: str | None = None
    importe_a_facturar: str | None = None
    id_deposito: str | None = None
    id_tipo_vehiculo: str | None = None
    id_marca: str | None = None
    id_modelo: str | None = None
    version: str | None = None
    anio: str | None = None


@dataclass(frozen=True)
class TareaCsv:
    line_number: int
    id_tarea: str | None
    id_ot: str | None
    descripcion: str | None
    cant_horas_venta: str | None
    precio_hora_venta: str | None
    importe_horas_venta: str | None
    cant_horas_costo: str | None
    precio_hora_costo: str | None
    importe_costo: str | None
    id_operario: str | None
    grupo_tarea: str | None
    fecha_realizado: str | None
    kilometraje: str | None = None


@dataclass(frozen=True)
class RepuestoCsv:
    line_number: int
    id_ot: str | None
    id_renglon: str | None
    id_repuesto: str | None
    descripcion: str | None
    cantidad: str | None
    estado: str | None
    precio_total: str | None
    costo_real: str | None
    codigo: str | None


@dataclass
class DatosOrigen:
    clientes: list[ClienteCsv]
    vehiculos: list[VehiculoCsv]
    operarios: list[OperarioCsv]
    ordenes: list[OrdenCsv]
    tareas: list[TareaCsv]
    repuestos: list[RepuestoCsv]


# --------------------------------------------------------------------------
# Registros preparados para B2Car
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ClienteImportable:
    tipo_cliente: str
    nombre: str
    apellido: str | None
    identificacion: str | None
    direccion: str | None
    telefono: str | None
    email: str | None


@dataclass
class ClientePendiente:
    cliente_id: str
    cliente: ClienteImportable
    filas: list[tuple[str, ClienteCsv]]


@dataclass(frozen=True)
class VehiculoImportable:
    patente: str
    marca: str
    modelo: str
    fecha_patente: str | None
    color: str
    numero_chasis: str
    numero_motor: str


@dataclass
class VehiculoPendiente:
    vehiculo_id: str
    cliente_id: str
    vehiculo: VehiculoImportable
    filas: list[VehiculoCsv]


@dataclass(frozen=True)
class VehiculoRef:
    vehiculo_id: str
    cliente_id: str | None
    preexistente: bool


@dataclass
class MapaVehiculos:
    por_patente: dict[str, VehiculoRef] = field(default_factory=dict)
    # Patente -> codigo de la incidencia que impidio importar el vehiculo.
    fallidos: dict[str, str] = field(default_factory=dict)
    patentes_csv: set[str] = field(default_factory=set)


@dataclass
class OperarioImportable:
    nombre: str
    apellido: str
    # None: IdOperario no permite derivar el DNI ficticio; se asigna al crear.
    dni: str | None
    dni_ficticio: bool
    telefono: str | None
    valor_hora: Decimal | None


@dataclass
class OperarioPendiente:
    empleado_id: str
    id_origen: str
    fila: OperarioCsv
    operario: OperarioImportable
    avisos: list[Aviso]


@dataclass
class MapaOperarios:
    por_id: dict[str, str] = field(default_factory=dict)
    ambiguos: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class ValoresTarea:
    horas_facturadas: Decimal
    precio_hora_facturada: Decimal
    horas_trabajadas: Decimal
    valor_hora_empleado: Decimal | None
    sin_importe_venta: bool = False
    costo_desconocido: bool = False


@dataclass
class TareaPlanificada:
    id_tarea: str
    fila: TareaCsv
    valores: ValoresTarea
    avisos: list[Aviso]


@dataclass
class DetallePlan:
    detalle_id: str
    descripcion: str
    valores: ValoresTarea
    empleado_id: str | None
    categoria_id: str | None
    created_at: datetime
    # None en la tarea de ajuste y en los repuestos migrados como detalle.
    id_tarea: str | None
    es_ajuste: bool = False


@dataclass(frozen=True)
class ValoresRepuesto:
    cantidad: Decimal
    # Importe de venta de la fila con IVA, redondeado a centavos.
    importe_venta: Decimal
    # Precio y costo por unidad de origen (litro, gramo, unidad), para el producto.
    precio_unitario: Decimal
    costo_unitario: Decimal | None
    cantidad_fraccionaria: bool = False
    sin_importe_venta: bool = False


@dataclass
class RepuestoPlanificado:
    id_ot: str
    id_renglon: str
    fila: RepuestoCsv
    # Codigo del sistema anterior o descripcion normalizada: identifica el producto.
    clave_producto: str
    codigo: str | None
    nombre: str
    valores: ValoresRepuesto
    avisos: list[Aviso]

    @property
    def id_origen(self) -> str:
        return f"{self.id_ot}-{self.id_renglon}"

    @property
    def orden(self) -> tuple[tuple[int, int, str], tuple[int, int, str]]:
        return clave_orden_id(self.id_ot), clave_orden_id(self.id_renglon)


@dataclass
class ProductoPendiente:
    producto_id: str
    clave: str
    codigo: str
    nombre: str
    precio_unitario: Decimal
    costo_unitario: Decimal
    referencia: RepuestoPlanificado


@dataclass
class LineaRepuestoPlan:
    linea_id: str
    stock_id: str
    cantidad: int
    monto_unitario: Decimal
    created_at: datetime


@dataclass
class ArregloPlan:
    arreglo_id: str
    id_ot: str
    orden: OrdenCsv
    referencias: str
    vehiculo_id: str
    cliente_id: str | None
    fecha: datetime
    kilometraje: int | None
    descripcion: str
    observaciones: str | None
    precio_final: Decimal
    extra_data: dict[str, Any]
    detalles: list[DetallePlan]
    tareas: list[TareaPlanificada]
    lineas_repuesto: list[LineaRepuestoPlan] = field(default_factory=list)
    repuestos: list[RepuestoPlanificado] = field(default_factory=list)

    @property
    def tiene_ajuste(self) -> bool:
        return any(detalle.es_ajuste for detalle in self.detalles)

    @property
    def operacion_id(self) -> str:
        return operacion_id_de_arreglo(self.arreglo_id)


# --------------------------------------------------------------------------
# Reporte y resumen
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Incidencia:
    nivel: str
    codigo: str
    entidad: str
    archivo: str
    linea_csv: int | None
    id_origen: str | None
    referencias: str
    motivo: str


@dataclass
class EstadisticasEntidad:
    leidos: int = 0
    creados: int = 0
    reutilizados: int = 0
    ya_migrados: int = 0
    fallidos: int = 0
    warnings: int = 0


class Reporte:
    def __init__(self) -> None:
        self.incidencias: list[Incidencia] = []
        self.estadisticas = {entidad: EstadisticasEntidad() for entidad in ENTIDADES}
        self.contadores: Counter[str] = Counter({nombre: 0 for nombre in CONTADORES})
        self.depositos: set[str] = set()
        self.importe_total_migrado = Decimal("0.00")

    def _registrar(
        self,
        nivel: str,
        entidad: str,
        codigo: str,
        motivo: str,
        linea: int | None = None,
        id_origen: str | None = None,
        referencias: str = "",
    ) -> None:
        self.incidencias.append(
            Incidencia(
                nivel=nivel,
                codigo=codigo,
                entidad=entidad,
                archivo=ARCHIVO_POR_ENTIDAD.get(entidad, ""),
                linea_csv=linea,
                id_origen=id_origen,
                referencias=referencias,
                motivo=motivo,
            )
        )

    def warning(self, entidad: str, codigo: str, motivo: str, **contexto: Any) -> None:
        self._registrar("warning", entidad, codigo, motivo, **contexto)
        if entidad in self.estadisticas:
            self.estadisticas[entidad].warnings += 1

    def avisos(self, entidad: str, avisos: Iterable[Aviso], **contexto: Any) -> None:
        for aviso in avisos:
            self.warning(entidad, aviso.codigo, aviso.motivo, **contexto)

    def error(self, entidad: str, codigo: str, motivo: str, **contexto: Any) -> None:
        self._registrar("error", entidad, codigo, motivo, **contexto)
        logging.error(
            "%s %s linea=%s id=%s: %s",
            entidad,
            codigo,
            contexto.get("linea") or "-",
            contexto.get("id_origen") or "-",
            motivo,
        )

    def rechazar(self, entidad: str, codigo: str, motivo: str, **contexto: Any) -> None:
        """Registra un error por registro de origen y lo cuenta como fallido."""
        self.error(entidad, codigo, motivo, **contexto)
        self.estadisticas[entidad].fallidos += 1

    @property
    def cantidad_errores(self) -> int:
        return sum(1 for incidencia in self.incidencias if incidencia.nivel == "error")

    @property
    def cantidad_warnings(self) -> int:
        return sum(1 for incidencia in self.incidencias if incidencia.nivel == "warning")


def formatear_referencias(**valores: Any) -> str:
    return " ".join(f"{clave}={valor}" for clave, valor in valores.items() if valor not in (None, ""))


def escribir_reporte(path: Path, incidencias: list[Incidencia]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=REPORTE_CAMPOS, delimiter=";")
            writer.writeheader()
            for incidencia in incidencias:
                writer.writerow(
                    {
                        "nivel": incidencia.nivel,
                        "codigo": incidencia.codigo,
                        "entidad": incidencia.entidad,
                        "archivo": incidencia.archivo,
                        "linea_csv": "" if incidencia.linea_csv is None else str(incidencia.linea_csv),
                        "id_origen": incidencia.id_origen or "",
                        "referencias": incidencia.referencias,
                        "motivo": incidencia.motivo,
                    }
                )
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def registrar_resumen(reporte: Reporte, dry_run: bool) -> None:
    etiqueta_creados = "a_crear" if dry_run else "creados"
    for entidad, stats in reporte.estadisticas.items():
        logging.info(
            "resumen %s: leidos=%s %s=%s reutilizados=%s ya_migrados=%s fallidos=%s warnings=%s",
            entidad,
            stats.leidos,
            etiqueta_creados,
            stats.creados,
            stats.reutilizados,
            stats.ya_migrados,
            stats.fallidos,
            stats.warnings,
        )
    logging.info(
        "resumen contadores: %s",
        " ".join(f"{nombre}={reporte.contadores[nombre]}" for nombre in CONTADORES),
    )
    logging.info(
        "resumen depositos_distintos=%s importe_total_migrado=%s",
        ",".join(sorted(reporte.depositos, key=clave_orden_id)) or "-",
        formatear_decimal(reporte.importe_total_migrado),
    )


# --------------------------------------------------------------------------
# Normalizacion
# --------------------------------------------------------------------------


def normalizar_texto(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().split())
    if not normalized or normalized.casefold() in VALORES_NULOS:
        return None
    return normalized


def quitar_tildes(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def normalizar_encabezado(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", quitar_tildes(value).casefold()).strip()


def normalizar_clave(value: str) -> str:
    """Clave de comparacion sin tildes, mayusculas ni espacios repetidos."""
    return " ".join(quitar_tildes(value).casefold().split())


def normalizar_id_origen(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    # Excel suele exportar enteros como "7.0".
    match = re.fullmatch(r"(\d+)(?:\.0+)?", text)
    if match:
        canonical = str(int(match.group(1)))
        return None if canonical == "0" else canonical
    return text


def clave_orden_id(value: str | None) -> tuple[int, int, str]:
    if value is not None and value.isdigit():
        return (0, int(value), "")
    return (1, 0, value or "")


def normalizar_identificacion(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None or text == "0":
        return None
    digits = re.sub(r"\D", "", text)
    if not digits or set(digits) == {"0"}:
        return None
    return digits


def normalizar_patente(value: str | None) -> str | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    normalized = re.sub(r"[^0-9A-Za-z]", "", text).upper()
    return normalized or None


def normalizar_codigo_producto(value: str | None) -> str | None:
    """Codigo de producto en mayusculas; ``0`` tambien significa ausencia."""
    text = valor_presente(value)
    return text.upper() if text is not None else None


def operacion_id_de_arreglo(arreglo_id: str) -> str:
    return str(uuid5(NAMESPACE_OPERACION_ARREGLO, arreglo_id))


def patente_es_estandar(patente: str) -> bool:
    return any(formato.match(patente) for formato in PATENTE_FORMATOS)


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


def tipo_por_cuit(value: str) -> str | None:
    if len(value) != 11 or not identificacion_11_es_valida(value):
        return None
    if value[:2] in COMPANY_CUIT_PREFIXES:
        return "empresa"
    if value[:2] in PERSON_CUIL_PREFIXES:
        return "particular"
    return None


def valor_presente(value: str | None) -> str | None:
    """Texto normalizado donde ``0`` tambien significa ausencia."""
    text = normalizar_texto(value)
    return None if text is None or text == "0" else text


def formatear_decimal(value: Decimal) -> str:
    return str(value.quantize(CENTAVOS, ROUND_HALF_UP))


def redondear(value: Decimal) -> Decimal:
    return value.quantize(CENTAVOS, ROUND_HALF_UP)


def con_iva_origen(value: Decimal) -> Decimal:
    """Importe neto del sistema anterior llevado a final (sin redondear)."""
    return value * (1 + IVA_ORIGEN)


def decimal_json(value: Decimal | None) -> float | None:
    # Los valores tienen 2 decimales y quedan muy por debajo de 2**53: la
    # representacion float mas corta coincide con el decimal original.
    return None if value is None else float(value)


def decimal_desde_base(value: Any) -> Decimal | None:
    if value is None:
        return None
    return redondear(Decimal(str(value)))


# --------------------------------------------------------------------------
# Parsing de valores
# --------------------------------------------------------------------------


def parse_decimal(value: str | None) -> Decimal | None:
    """Devuelve None si falta y ValueError si no es un numero finito."""
    text = normalizar_texto(value)
    if text is None:
        return None
    compact = text.replace(" ", "").replace("$", "")
    if "," in compact and "." in compact:
        # El ultimo separador es el decimal: 1.234,56 o 1,234.56.
        if compact.rfind(",") > compact.rfind("."):
            compact = compact.replace(".", "").replace(",", ".")
        else:
            compact = compact.replace(",", "")
    elif "," in compact:
        compact = compact.replace(",", ".")
    try:
        number = Decimal(compact)
    except InvalidOperation as error:
        raise ValueError("no es un numero") from error
    if not number.is_finite():
        raise ValueError("no es un numero finito")
    return number


def leer_importe(
    value: str | None,
    campo: str,
    avisos: list[Aviso],
    *,
    negativo_es_error: bool = False,
    codigo_error: str = "TAREA_VALOR_FUERA_DE_RANGO",
) -> Decimal | None:
    """Importe, precio u horas positivos; cero y ausencia significan sin dato."""
    try:
        number = parse_decimal(value)
    except ValueError:
        avisos.append(Aviso("VALOR_NUMERICO_INVALIDO", f"{campo} no es un numero valido; se toma como sin dato"))
        return None
    if number is None or number == 0:
        return None
    if number < 0:
        if negativo_es_error:
            raise RegistroInvalido(codigo_error, f"{campo} es negativo")
        avisos.append(Aviso("VALOR_NUMERICO_INVALIDO", f"{campo} es negativo; se toma como sin dato"))
        return None
    return number


def parse_entero_positivo(value: str | None) -> int | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", text):
        # Separador de miles de una planilla: 123.456 km.
        text = text.replace(".", "")
    try:
        number = parse_decimal(text)
    except ValueError:
        return None
    if number is None or number <= 0 or number != number.to_integral_value():
        return None
    result = int(number)
    return result if result <= MAX_ENTERO else None


def parse_fecha_origen(value: str | None, ahora: datetime) -> datetime | None:
    """Fecha del sistema anterior en hora argentina; ValueError si es invalida."""
    text = normalizar_texto(value)
    if text is None:
        return None
    for formato in FORMATOS_FECHA:
        try:
            parsed = datetime.strptime(text, formato)
        except ValueError:
            continue
        fecha = parsed.replace(tzinfo=ZONA_HORARIA_ORIGEN)
        if fecha.year < 1900 or (fecha.year == 1900 and fecha.month == 1 and fecha.day == 1):
            raise ValueError("es una fecha centinela o anterior a 1900")
        if fecha > ahora + timedelta(days=1):
            raise ValueError("es posterior a hoy")
        return fecha
    raise ValueError("no tiene un formato de fecha reconocido")


def parse_booleano(value: str | None) -> bool | None:
    text = normalizar_texto(value)
    if text is None:
        return None
    clave = normalizar_clave(text)
    if clave in {"1", "-1", "true", "t", "si", "s", "yes", "y", "verdadero"}:
        return True
    if clave in {"0", "false", "f", "no", "n", "falso"}:
        return False
    return None


def texto_importe(value: str | None) -> str | None:
    """Importe original para extra_data: string para no perder decimales."""
    text = normalizar_texto(value)
    if text is None:
        return None
    try:
        number = parse_decimal(text)
    except ValueError:
        return text
    return formatear_decimal(number) if number is not None else None


# --------------------------------------------------------------------------
# Lectura de CSV
# --------------------------------------------------------------------------


def detectar_delimitador(sample: str) -> str:
    header = sample.splitlines()[0] if sample else ""
    counts = {delimiter: header.count(delimiter) for delimiter in DELIMITADORES}
    best = max(counts, key=lambda delimiter: counts[delimiter])
    if counts[best] > 0:
        return best
    try:
        return csv.Sniffer().sniff(sample, delimiters="".join(DELIMITADORES)).delimiter
    except csv.Error:
        return ","


def positions_for_headers(headers: list[str], aliases: set[str]) -> list[int]:
    return [index for index, header in enumerate(headers) if normalizar_encabezado(header) in aliases]


def first_value(values: list[str], positions: Iterable[int]) -> str | None:
    for position in positions:
        value = normalizar_texto(values[position] if position < len(values) else None)
        if value is not None:
            return value
    return None


def read_csv_rows(
    csv_path: Path,
    required: dict[str, set[str]],
    optional: dict[str, set[str]],
    encoding: str,
) -> list[tuple[int, dict[str, str | None]]]:
    try:
        with csv_path.open("r", encoding=encoding, newline="") as file:
            sample = file.read(65536)
            file.seek(0)
            reader = csv.reader(file, delimiter=detectar_delimitador(sample))
            try:
                headers = next(reader)
            except StopIteration as error:
                raise ErrorFatal(f"el CSV esta vacio: {csv_path.name}") from error

            positions = {
                campo: positions_for_headers(headers, aliases)
                for campo, aliases in {**required, **optional}.items()
            }
            faltantes = [campo for campo in required if not positions[campo]]
            if faltantes:
                raise ErrorFatal(
                    f"el CSV {csv_path.name} no incluye las columnas requeridas: {', '.join(faltantes)}"
                )
            ausentes = [campo for campo in optional if not positions[campo]]
            if ausentes:
                logging.info("archivo=%s columnas_opcionales_ausentes=%s", csv_path.name, ",".join(ausentes))

            rows: list[tuple[int, dict[str, str | None]]] = []
            while True:
                # line_num avanza por lineas fisicas: conserva la linea de inicio
                # aunque un campo entre comillas tenga saltos de linea.
                line_number = reader.line_num + 1
                try:
                    values = next(reader)
                except StopIteration:
                    break
                if not any(normalizar_texto(value) for value in values):
                    continue
                rows.append(
                    (
                        line_number,
                        {campo: first_value(values, campo_positions) for campo, campo_positions in positions.items()},
                    )
                )
            return rows
    except UnicodeDecodeError as error:
        raise ErrorFatal(
            f"no se pudo leer {csv_path.name} con encoding {encoding}; "
            "si fue exportado desde Excel en Windows, reintentar con --encoding cp1252"
        ) from error


def localizar_archivos(directorio: Path) -> dict[str, Path]:
    por_nombre = {path.name.casefold(): path for path in directorio.iterdir() if path.is_file()}
    faltantes = [nombre for nombre in ARCHIVOS.values() if nombre.casefold() not in por_nombre]
    if faltantes:
        raise ErrorFatal(f"faltan archivos en {directorio}: {', '.join(faltantes)}")
    return {entidad: por_nombre[nombre.casefold()] for entidad, nombre in ARCHIVOS.items()}


def leer_archivos(archivos: dict[str, Path], encoding: str) -> DatosOrigen:
    def leer(entidad: str, required: dict[str, set[str]], optional: dict[str, set[str]], factory: Callable[..., T]) -> list[T]:
        return [
            factory(line_number=line_number, **values)
            for line_number, values in read_csv_rows(archivos[entidad], required, optional, encoding)
        ]

    return DatosOrigen(
        clientes=leer("cliente", CLIENTES_REQUERIDAS, CLIENTES_OPCIONALES, ClienteCsv),
        vehiculos=leer("vehiculo", VEHICULOS_REQUERIDAS, {}, VehiculoCsv),
        operarios=leer("operario", OPERARIOS_REQUERIDAS, OPERARIOS_OPCIONALES, OperarioCsv),
        ordenes=leer("orden", ORDENES_REQUERIDAS, ORDENES_OPCIONALES, OrdenCsv),
        tareas=leer("tarea", TAREAS_REQUERIDAS, TAREAS_OPCIONALES, TareaCsv),
        repuestos=leer("repuesto", REPUESTOS_REQUERIDAS, {}, RepuestoCsv),
    )


# --------------------------------------------------------------------------
# Configuracion y Supabase
# --------------------------------------------------------------------------


def validate_config() -> tuple[str, str]:
    try:
        tenant_id = str(UUID(TENANT_ID))
        taller_id = str(UUID(TALLER_ID))
    except ValueError as error:
        raise ErrorFatal("configura TENANT_ID/TALLER_ID con un UUID valido antes de ejecutar") from error
    return tenant_id, taller_id


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
        raise ErrorFatal("falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL en las variables de entorno")
    if not service_role_key:
        raise ErrorFatal("falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno")
    try:
        from supabase import create_client
        from supabase.client import ClientOptions
    except ImportError as error:
        raise ErrorFatal(
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


def describir_error(error: BaseException) -> str:
    """Mensaje sin ``details`` de PostgREST, que puede incluir valores de la fila."""
    message = getattr(error, "message", None)
    if isinstance(message, str) and message:
        code = getattr(error, "code", None)
        return f"{code}: {message}" if code else message
    return f"{type(error).__name__}: {error}"


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
            raise ErrorFatal(f"{phase}: Supabase devolvio una respuesta inesperada")
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def chunked(values: list[T], size: int) -> Iterable[list[T]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def listar_tabla(
    supabase: Any,
    phase: str,
    table: str,
    columns: str,
    filtros: Iterable[tuple[str, Any]],
) -> list[dict[str, Any]]:
    filtros = list(filtros)

    def make_query():
        query = supabase.table(table).select(columns)
        for column, value in filtros:
            query = query.eq(column, value)
        # Orden estable para que la paginacion por rango no omita filas.
        return query.order("id")

    return fetch_paginated(phase, make_query)


def consultar_por_valores(
    supabase: Any,
    phase: str,
    table: str,
    columns: str,
    column: str,
    values: Iterable[str],
    filtros: Iterable[tuple[str, Any]],
    orden: str = "id",
) -> list[dict[str, Any]]:
    filtros = list(filtros)
    rows: list[dict[str, Any]] = []
    for index, lote in enumerate(chunked(sorted(set(values)), LOOKUP_CHUNK_SIZE), start=1):

        def make_query(lote: list[str] = lote):
            query = supabase.table(table).select(columns).in_(column, lote)
            for filtro_column, value in filtros:
                query = query.eq(filtro_column, value)
            # Orden estable para paginar; la tabla debe tener esa columna.
            return query.order(orden)

        rows.extend(fetch_paginated(f"{phase}_lote_{index}", make_query))
    return rows


def insertar_con_aislamiento(
    items: list[T],
    insertar: Callable[[list[T]], None],
    al_fallar: Callable[[T, Exception], None],
) -> list[T]:
    """Inserta el lote y, si falla, lo divide por biseccion hasta aislar las filas."""
    if not items:
        return []
    try:
        insertar(items)
        return items
    except ErrorFatal:
        raise
    except Exception as error:
        if len(items) > 1:
            midpoint = len(items) // 2
            return insertar_con_aislamiento(items[:midpoint], insertar, al_fallar) + insertar_con_aislamiento(
                items[midpoint:], insertar, al_fallar
            )
        al_fallar(items[0], error)
        return []


# --------------------------------------------------------------------------
# Archivo de estado
# --------------------------------------------------------------------------


@dataclass
class EstadoMigracion:
    path: Path
    tenant_id: str
    taller_id: str
    origen: str
    clientes: dict[str, str] = field(default_factory=dict)
    vehiculos: dict[str, str] = field(default_factory=dict)
    operarios: dict[str, str] = field(default_factory=dict)
    categorias: dict[str, str] = field(default_factory=dict)
    productos: dict[str, str] = field(default_factory=dict)
    ordenes: dict[str, str] = field(default_factory=dict)
    # Modo con el que se migraron los repuestos; no se mezclan modos en un tenant.
    # None hasta confirmarlo contra lo migrado: un error previo no lo fija.
    modo_repuestos: str | None = None

    def seccion(self, nombre: str) -> dict[str, str]:
        return getattr(self, nombre)

    def to_json(self) -> dict[str, Any]:
        return {
            "version": ESTADO_VERSION,
            "tenant_id": self.tenant_id,
            "taller_id": self.taller_id,
            "origen": self.origen,
            "modo_repuestos": self.modo_repuestos,
            "actualizado_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **{nombre: dict(sorted(self.seccion(nombre).items(), key=lambda item: clave_orden_id(item[0]))) for nombre in SECCIONES_ESTADO},
        }

    def guardar(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self.path.with_name(f".{self.path.name}.{os.getpid()}.tmp")
        try:
            temporary_path.write_text(json.dumps(self.to_json(), indent=2, ensure_ascii=False), encoding="utf-8")
            os.replace(temporary_path, self.path)
        finally:
            if temporary_path.exists():
                temporary_path.unlink()

    @classmethod
    def cargar(
        cls, path: Path, tenant_id: str, taller_id: str, origen: str, modo_repuestos: str = MODO_REPUESTOS_PRODUCTOS
    ) -> EstadoMigracion:
        estado = cls(path=path, tenant_id=tenant_id, taller_id=taller_id, origen=origen)
        if not path.exists():
            return estado
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ErrorFatal(f"no se pudo leer el archivo de estado {path}: {error}") from error
        if not isinstance(data, dict) or data.get("version") != ESTADO_VERSION:
            raise ErrorFatal(f"el archivo de estado {path} no tiene la version {ESTADO_VERSION}")
        for clave, esperado in (("tenant_id", tenant_id), ("taller_id", taller_id), ("origen", origen)):
            if data.get(clave) != esperado:
                raise ErrorFatal(
                    f"el archivo de estado {path} corresponde a otro {clave}; "
                    "usar el estado de esta migracion o indicar otro --estado-path"
                )
        # Un estado anterior a --repuestos no trae el modo y se acepta.
        modo_guardado = data.get("modo_repuestos")
        if modo_guardado is not None and modo_guardado != modo_repuestos:
            raise ErrorFatal(
                f"el archivo de estado {path} se genero con --repuestos {modo_guardado}; "
                f"no se pueden mezclar modos. Usar --repuestos {modo_guardado} o limpiar lo migrado"
            )
        estado.modo_repuestos = modo_guardado
        for nombre in SECCIONES_ESTADO:
            seccion = data.get(nombre, {})
            if not isinstance(seccion, dict):
                raise ErrorFatal(f"el archivo de estado {path} tiene la seccion {nombre} corrupta")
            for clave, valor in seccion.items():
                try:
                    UUID(str(valor))
                except ValueError as error:
                    raise ErrorFatal(f"el archivo de estado {path} tiene un UUID invalido en {nombre}") from error
                estado.seccion(nombre)[str(clave)] = str(valor)
        return estado


@dataclass
class Contexto:
    supabase: Any
    tenant_id: str
    taller_id: str
    dry_run: bool
    batch_size: int
    reporte: Reporte
    estado: EstadoMigracion
    ahora: datetime = field(default_factory=lambda: datetime.now(ZONA_HORARIA_ORIGEN))
    progress_every: int = 100
    modo_repuestos: str = MODO_REPUESTOS_PRODUCTOS

    def guardar_estado(self) -> None:
        if not self.dry_run:
            self.estado.guardar()

    def filtro_tenant(self) -> list[tuple[str, Any]]:
        return [("tenant_id", self.tenant_id)]

    def informar_progreso(self, fase: str, procesados: int) -> None:
        if procesados == 1 or procesados % self.progress_every == 0:
            logging.info("fase=%s_progreso: %s procesados", fase, procesados)


def validar_estado_en_base(ctx: Contexto) -> None:
    """Descarta IDs del estado que ya no existen y limpia clientes base huerfanos."""
    tablas = {
        "clientes": ("clientes", ctx.filtro_tenant()),
        "vehiculos": ("vehiculos", ctx.filtro_tenant()),
        "operarios": ("empleados", ctx.filtro_tenant() + [("taller_id", ctx.taller_id)]),
        "categorias": ("categorias_arreglo", ctx.filtro_tenant()),
        "productos": ("productos", ctx.filtro_tenant()),
        "ordenes": ("arreglos", ctx.filtro_tenant()),
    }
    for seccion, (tabla, filtros) in tablas.items():
        mapa = ctx.estado.seccion(seccion)
        if not mapa:
            continue
        existentes = {
            row["id"]
            for row in consultar_por_valores(
                ctx.supabase, f"estado_{seccion}", tabla, "id", "id", mapa.values(), filtros
            )
        }
        for clave, uuid in list(mapa.items()):
            if uuid not in existentes:
                del mapa[clave]
                ctx.reporte.warning(
                    "estado",
                    "ESTADO_ID_INEXISTENTE",
                    f"el registro de {seccion} del estado ya no existe en la base; se vuelve a procesar",
                    id_origen=clave,
                )

    cliente_ids = set(ctx.estado.clientes.values())
    if not cliente_ids:
        return
    con_detalle: set[str] = set()
    for tabla in ("particulares", "empresas"):
        con_detalle.update(
            row["id"]
            for row in consultar_por_valores(
                ctx.supabase, f"estado_{tabla}", tabla, "id", "id", cliente_ids, ctx.filtro_tenant()
            )
        )
    huerfanos = cliente_ids - con_detalle
    if not huerfanos:
        return
    con_vehiculos = consultar_por_valores(
        ctx.supabase, "estado_huerfanos_vehiculos", "vehiculos", "id,cliente_id", "cliente_id", huerfanos, ctx.filtro_tenant()
    )
    if con_vehiculos:
        raise ErrorFatal(
            "hay clientes base sin particular/empresa que ya tienen vehiculos; revisarlos manualmente: "
            + ", ".join(sorted({row["cliente_id"] for row in con_vehiculos}))
        )
    if not ctx.dry_run:
        for lote in chunked(sorted(huerfanos), LOOKUP_CHUNK_SIZE):
            try:
                execute_traced(
                    "estado_borrar_clientes_huerfanos",
                    lambda lote=lote: ctx.supabase.table("clientes")
                    .delete()
                    .in_("id", lote)
                    .eq("tenant_id", ctx.tenant_id)
                    .execute(),
                )
            except Exception as error:
                raise ErrorFatal(
                    f"no se pudieron borrar clientes base huerfanos ({', '.join(lote)}): {describir_error(error)}"
                ) from error
    for clave, uuid in list(ctx.estado.clientes.items()):
        if uuid in huerfanos:
            del ctx.estado.clientes[clave]
            ctx.reporte.warning(
                "estado",
                "ESTADO_CLIENTE_HUERFANO",
                "el cliente base no tenia particular/empresa (corte a mitad de insercion); se vuelve a crear",
                id_origen=clave,
            )
    ctx.guardar_estado()


# --------------------------------------------------------------------------
# Validaciones iniciales contra la base
# --------------------------------------------------------------------------


def contar_por_tenant(supabase: Any, table: str, tenant_id: str) -> int | None:
    response = execute_traced(
        f"conteo_{table}",
        lambda: supabase.table(table).select("id", count="exact").eq("tenant_id", tenant_id).limit(1).execute(),
    )
    return getattr(response, "count", None)


def validar_destino(supabase: Any, tenant_id: str, taller_id: str) -> None:
    tenant = execute_traced(
        "validacion_tenant",
        lambda: supabase.table("tenants").select("id,nombre").eq("id", tenant_id).limit(1).execute(),
    ).data
    if not tenant:
        raise ErrorFatal("TENANT_ID no corresponde a un tenant existente")
    taller = execute_traced(
        "validacion_taller",
        lambda: supabase.table("talleres").select("id,nombre,tenant_id").eq("id", taller_id).limit(1).execute(),
    ).data
    if not taller or taller[0].get("tenant_id") != tenant_id:
        raise ErrorFatal("TALLER_ID no corresponde a un taller del tenant configurado")
    logging.info(
        "destino: tenant=%s taller=%s clientes=%s vehiculos=%s arreglos=%s",
        tenant[0].get("nombre"),
        taller[0].get("nombre"),
        contar_por_tenant(supabase, "clientes", tenant_id),
        contar_por_tenant(supabase, "vehiculos", tenant_id),
        contar_por_tenant(supabase, "arreglos", tenant_id),
    )


def verificar_columnas(supabase: Any) -> None:
    for table, columns in COLUMNAS_VERIFICADAS.items():
        try:
            execute_traced(
                f"validacion_columnas_{table}",
                lambda table=table, columns=columns: supabase.table(table).select(columns).limit(1).execute(),
            )
        except Exception as error:
            raise ErrorFatal(
                f"la tabla {table} no expone las columnas {columns}; revisar que las migraciones esten aplicadas: "
                f"{describir_error(error)}"
            ) from error


# --------------------------------------------------------------------------
# Clientes
# --------------------------------------------------------------------------


def build_address(row: ClienteCsv) -> str | None:
    street = valor_presente(row.calle)
    number = valor_presente(row.calle_nro)
    floor = valor_presente(row.piso)
    department = valor_presente(row.depto)
    locality = valor_presente(row.localidad)
    province = valor_presente(row.provincia)

    parts: list[str] = []
    if street and number:
        parts.append(f"{street} {number}")
    elif street:
        parts.append(street)
    elif number:
        parts.append(f"Numero {number}")
    if floor:
        parts.append(f"Piso {floor}")
    if department:
        parts.append(f"Depto {department}")
    if locality:
        parts.append(locality)
    if province:
        parts.append(province)
    return ", ".join(parts) or None


def clasificar_identificacion(row: ClienteCsv, avisos: list[Aviso]) -> tuple[str, str | None]:
    cuit = normalizar_identificacion(row.nro_cuit)
    if cuit is not None:
        tipo = tipo_por_cuit(cuit) if len(cuit) == 11 else None
        if tipo is not None:
            return tipo, cuit
        avisos.append(Aviso("CUIT_INVALIDO", "Nro_CUIT no es un CUIT/CUIL valido; se evalua NroDocumento"))

    documento = normalizar_identificacion(row.nro_documento)
    if documento is not None:
        if len(documento) == 11:
            tipo = tipo_por_cuit(documento)
            if tipo is not None:
                return tipo, documento
        elif is_dni(documento):
            return "particular", documento
        avisos.append(
            Aviso("DOCUMENTO_INVALIDO", "NroDocumento no es un DNI ni un CUIT/CUIL valido; se importa sin documento")
        )
    return "particular", None


def clasificar_cliente(row: ClienteCsv) -> tuple[ClienteImportable, list[Aviso]]:
    avisos: list[Aviso] = []
    nombre = normalizar_texto(row.razon_social)
    if nombre is None:
        nombre = normalizar_texto(row.nombre_fantasia)
        if nombre is None:
            raise RegistroInvalido("CLIENTE_SIN_NOMBRE", "Razon_Social y NombreFantasia estan vacios")
        avisos.append(Aviso("CLIENTE_NOMBRE_DESDE_FANTASIA", "Razon_Social vacia; se usa NombreFantasia"))

    tipo_cliente, identificacion = clasificar_identificacion(row, avisos)

    email = normalizar_texto(row.email)
    if email is not None and "@" not in email:
        avisos.append(Aviso("EMAIL_INVALIDO", "DireccionEmail no tiene formato de email; se omite"))
        email = None

    return (
        ClienteImportable(
            tipo_cliente=tipo_cliente,
            nombre=nombre,
            # particulares.apellido es NOT NULL y el origen no separa el apellido:
            # la cadena vacia evita inventar un dato personal (igual que el
            # importador existente).
            apellido="" if tipo_cliente == "particular" else None,
            identificacion=identificacion,
            direccion=build_address(row),
            telefono=valor_presente(row.telefono_movil) or valor_presente(row.telefono_fijo),
            email=email,
        ),
        avisos,
    )


def load_clientes_existentes(
    ctx: Contexto, tipo_cliente: str, identificaciones: set[str]
) -> tuple[dict[str, str], set[str]]:
    """Carga identificadores existentes exclusivamente del tenant destino."""
    if not identificaciones:
        return {}, set()
    table = "empresas" if tipo_cliente == "empresa" else "particulares"
    column = "cuit" if tipo_cliente == "empresa" else "dni_cuil"
    rows = consultar_por_valores(
        ctx.supabase, f"consulta_{table}_existentes", table, f"id,{column}", column, identificaciones, ctx.filtro_tenant()
    )
    clientes: dict[str, str] = {}
    duplicados: set[str] = set()
    for row in rows:
        identificacion = row.get(column)
        cliente_id = row.get("id")
        if not isinstance(identificacion, str) or not isinstance(cliente_id, str):
            raise ErrorFatal("un cliente existente no tiene una relacion base valida")
        if identificacion in clientes and clientes[identificacion] != cliente_id:
            duplicados.add(identificacion)
        else:
            clientes[identificacion] = cliente_id
    return clientes, duplicados


def insertar_clientes_lote(ctx: Contexto, lote: list[ClientePendiente]) -> None:
    client_ids = [pending.cliente_id for pending in lote]
    base_inserted = False
    try:
        execute_traced(
            f"insertar_clientes_lote_{len(lote)}",
            lambda: ctx.supabase.table("clientes")
            .insert(
                [
                    {
                        "id": pending.cliente_id,
                        "tenant_id": ctx.tenant_id,
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
                f"insertar_empresas_lote_{len(empresas)}",
                lambda: ctx.supabase.table("empresas")
                .insert(
                    [
                        {
                            "id": pending.cliente_id,
                            "tenant_id": ctx.tenant_id,
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
                f"insertar_particulares_lote_{len(particulares)}",
                lambda: ctx.supabase.table("particulares")
                .insert(
                    [
                        {
                            "id": pending.cliente_id,
                            "tenant_id": ctx.tenant_id,
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
                    f"revertir_clientes_lote_{len(lote)}",
                    lambda: ctx.supabase.table("clientes")
                    .delete()
                    .in_("id", client_ids)
                    .eq("tenant_id", ctx.tenant_id)
                    .execute(),
                )
            except Exception as rollback_error:
                raise ErrorFatal(
                    "fallo un detalle del lote y no se pudieron revertir sus clientes base: " + ", ".join(client_ids)
                ) from rollback_error
        raise insert_error


def procesar_clientes(ctx: Contexto, rows: list[ClienteCsv]) -> dict[str, str]:
    """Devuelve IdCliente de origen -> clientes.id del tenant destino."""
    reporte = ctx.reporte
    stats = reporte.estadisticas["cliente"]
    stats.leidos = len(rows)

    por_id: dict[str, list[ClienteCsv]] = defaultdict(list)
    for row in rows:
        id_origen = normalizar_id_origen(row.id_cliente)
        if id_origen is None:
            reporte.rechazar("cliente", "CLIENTE_SIN_ID", "IdCliente vacio o 0", linea=row.line_number)
            continue
        por_id[id_origen].append(row)

    mapa: dict[str, str] = {}
    candidatos: list[tuple[str, ClienteCsv, ClienteImportable]] = []
    for id_origen, filas in por_id.items():
        if len(filas) > 1:
            for row in filas:
                reporte.rechazar(
                    "cliente", "CLIENTE_ID_DUPLICADO", "IdCliente se repite en clientes.csv",
                    linea=row.line_number, id_origen=id_origen,
                )
            continue
        row = filas[0]
        migrado = ctx.estado.clientes.get(id_origen)
        if migrado is not None:
            mapa[id_origen] = migrado
            stats.ya_migrados += 1
            continue
        try:
            cliente, avisos = clasificar_cliente(row)
        except RegistroInvalido as error:
            reporte.rechazar("cliente", error.codigo, error.motivo, linea=row.line_number, id_origen=id_origen)
            continue
        reporte.avisos("cliente", avisos, linea=row.line_number, id_origen=id_origen)
        candidatos.append((id_origen, row, cliente))

    existentes: dict[str, tuple[dict[str, str], set[str]]] = {}
    for tipo in ("empresa", "particular"):
        identificaciones = {
            cliente.identificacion
            for _, _, cliente in candidatos
            if cliente.tipo_cliente == tipo and cliente.identificacion is not None
        }
        existentes[tipo] = load_clientes_existentes(ctx, tipo, identificaciones)

    pendientes: dict[tuple[str, str], ClientePendiente] = {}
    for id_origen, row, cliente in candidatos:
        if cliente.identificacion is not None:
            por_identificacion, duplicados = existentes[cliente.tipo_cliente]
            if cliente.identificacion in duplicados:
                reporte.rechazar(
                    "cliente", "CLIENTE_EXISTENTE_AMBIGUO",
                    "hay mas de un cliente existente en el tenant con el mismo documento",
                    linea=row.line_number, id_origen=id_origen,
                )
                continue
            existente = por_identificacion.get(cliente.identificacion)
            if existente is not None:
                mapa[id_origen] = existente
                ctx.estado.clientes[id_origen] = existente
                stats.reutilizados += 1
                continue
            key = (cliente.tipo_cliente, cliente.identificacion)
        else:
            key = ("sin-documento", id_origen)

        pending = pendientes.get(key)
        if pending is None:
            pendientes[key] = ClientePendiente(str(uuid4()), cliente, [(id_origen, row)])
        else:
            pending.filas.append((id_origen, row))
            reporte.warning(
                "cliente", "CLIENTE_DOCUMENTO_COMPARTIDO",
                "comparte documento con otro IdCliente de clientes.csv; se crea un unico cliente",
                linea=row.line_number, id_origen=id_origen,
                referencias=formatear_referencias(IdClienteUnificado=pending.filas[0][0]),
            )

    lista = list(pendientes.values())
    logging.info("fase=clientes: a_crear=%s%s", len(lista), " (dry-run)" if ctx.dry_run else "")

    def registrar_exitosos(exitosos: list[ClientePendiente]) -> None:
        for pending in exitosos:
            for id_origen, _ in pending.filas:
                mapa[id_origen] = pending.cliente_id
            stats.creados += 1
            stats.reutilizados += len(pending.filas) - 1

    if ctx.dry_run:
        registrar_exitosos(lista)
        return mapa

    def al_fallar(pending: ClientePendiente, error: Exception) -> None:
        for id_origen, row in pending.filas:
            ctx.estado.clientes.pop(id_origen, None)
            reporte.rechazar(
                "cliente", "CLIENTE_INSERCION_FALLIDA", describir_error(error),
                linea=row.line_number, id_origen=id_origen,
            )

    for lote in chunked(lista, ctx.batch_size):
        for pending in lote:
            for id_origen, _ in pending.filas:
                ctx.estado.clientes[id_origen] = pending.cliente_id
        ctx.guardar_estado()
        registrar_exitosos(insertar_con_aislamiento(lote, lambda items: insertar_clientes_lote(ctx, items), al_fallar))
        ctx.guardar_estado()
    return mapa


# --------------------------------------------------------------------------
# Vehiculos
# --------------------------------------------------------------------------


def display_model(modelo: str | None, version: str | None) -> str:
    return " ".join(value for value in (normalizar_texto(modelo), normalizar_texto(version)) if value)


def combinar_filas_vehiculo(filas: list[VehiculoCsv]) -> VehiculoCsv:
    """Toma, campo por campo, el primer valor no vacio de las filas repetidas."""

    def primero(attr: str) -> str | None:
        return next((value for row in filas if (value := normalizar_texto(getattr(row, attr))) is not None), None)

    return VehiculoCsv(
        line_number=filas[0].line_number,
        patente=filas[0].patente,
        marca=primero("marca"),
        modelo=primero("modelo"),
        version=primero("version"),
        anio=primero("anio"),
        color=primero("color"),
        id_cliente=filas[0].id_cliente,
        chasis=primero("chasis"),
        motor=primero("motor"),
    )


def preparar_vehiculo(row: VehiculoCsv, anio_actual: int) -> tuple[VehiculoImportable, list[Aviso]]:
    patente = normalizar_patente(row.patente)
    if patente is None:
        raise RegistroInvalido("VEHICULO_SIN_PATENTE", "la patente esta vacia")
    avisos: list[Aviso] = []
    if not patente_es_estandar(patente):
        avisos.append(
            Aviso(
                "VEHICULO_PATENTE_NO_ESTANDAR",
                "la patente no coincide con los formatos argentinos de auto ni de moto; se importa tal cual",
            )
        )
    anio = normalizar_texto(row.anio)
    fecha_patente = None
    if anio is not None:
        match = re.fullmatch(r"(\d{4})(?:\.0+)?", anio)
        if match and 1900 <= int(match.group(1)) <= anio_actual + 1:
            fecha_patente = match.group(1)
        else:
            avisos.append(Aviso("VEHICULO_ANIO_INVALIDO", "Anio no es un año de 4 digitos valido; se omite"))
    return (
        VehiculoImportable(
            patente=patente,
            marca=normalizar_texto(row.marca) or "",
            modelo=display_model(row.modelo, row.version),
            fecha_patente=fecha_patente,
            color=normalizar_texto(row.color) or "",
            numero_chasis=(normalizar_texto(row.chasis) or "").upper(),
            numero_motor=(normalizar_texto(row.motor) or "").upper(),
        ),
        avisos,
    )


def vehicle_payload(vehiculo: VehiculoImportable, tenant_id: str, vehiculo_id: str, cliente_id: str) -> dict[str, Any]:
    return {
        "id": vehiculo_id,
        "tenant_id": tenant_id,
        "cliente_id": cliente_id,
        "patente": vehiculo.patente,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "fecha_patente": vehiculo.fecha_patente,
        "color": vehiculo.color,
        "numero_chasis": vehiculo.numero_chasis,
        "numero_motor": vehiculo.numero_motor,
    }


def load_vehiculos_tenant(ctx: Contexto) -> dict[str, tuple[str, str | None]]:
    rows = listar_tabla(ctx.supabase, "consulta_vehiculos_tenant", "vehiculos", "id,patente,cliente_id", ctx.filtro_tenant())
    vehiculos: dict[str, tuple[str, str | None]] = {}
    for row in rows:
        patente = normalizar_patente(row.get("patente"))
        if patente is not None and patente not in vehiculos:
            vehiculos[patente] = (row["id"], row.get("cliente_id"))
    return vehiculos


def procesar_vehiculos(ctx: Contexto, rows: list[VehiculoCsv], clientes: dict[str, str]) -> MapaVehiculos:
    reporte = ctx.reporte
    stats = reporte.estadisticas["vehiculo"]
    stats.leidos = len(rows)

    existentes = load_vehiculos_tenant(ctx)
    mapa = MapaVehiculos(
        por_patente={
            patente: VehiculoRef(vehiculo_id, cliente_id, preexistente=True)
            for patente, (vehiculo_id, cliente_id) in existentes.items()
        }
    )

    por_patente: dict[str, list[VehiculoCsv]] = defaultdict(list)
    for row in rows:
        patente = normalizar_patente(row.patente)
        if patente is None:
            reporte.rechazar(
                "vehiculo", "VEHICULO_SIN_PATENTE", "la patente esta vacia",
                linea=row.line_number, referencias=formatear_referencias(IdCliente=normalizar_id_origen(row.id_cliente)),
            )
            continue
        por_patente[patente].append(row)
    mapa.patentes_csv = set(por_patente)

    def rechazar_filas(patente: str, filas: list[VehiculoCsv], codigo: str, motivo: str) -> None:
        mapa.fallidos[patente] = codigo
        for row in filas:
            reporte.rechazar(
                "vehiculo", codigo, motivo, linea=row.line_number, id_origen=patente,
                referencias=formatear_referencias(IdCliente=normalizar_id_origen(row.id_cliente)),
            )

    def avisar_repetidas(patente: str, filas: list[VehiculoCsv]) -> None:
        for row in filas[1:]:
            reporte.warning(
                "vehiculo", "VEHICULO_PATENTE_REPETIDA",
                f"la patente se repite en vehiculos.csv (primera aparicion en la linea {filas[0].line_number}); se usa un unico vehiculo",
                linea=row.line_number, id_origen=patente,
            )

    pendientes: list[VehiculoPendiente] = []
    for indice, (patente, filas) in enumerate(por_patente.items(), start=1):
        ctx.informar_progreso("vehiculos", indice)
        existente = existentes.get(patente)
        migrado = ctx.estado.vehiculos.get(patente)
        if migrado is not None and existente is not None and existente[0] == migrado:
            stats.ya_migrados += len(filas)
            continue

        ids_cliente = [normalizar_id_origen(row.id_cliente) for row in filas]
        destinos = {clientes.get(id_cliente or "") or f"sin-mapa:{id_cliente}" for id_cliente in ids_cliente}
        if len(destinos) > 1:
            rechazar_filas(
                patente, filas, "VEHICULO_PATENTE_CONFLICTO",
                "la patente se repite en vehiculos.csv con distintos clientes; no se puede elegir el dueño",
            )
            continue
        cliente_id = clientes.get(ids_cliente[0] or "")
        if cliente_id is None:
            rechazar_filas(
                patente, filas, "VEHICULO_CLIENTE_NO_RESUELTO",
                "IdCliente no existe en clientes.csv, esta duplicado o no pudo importarse",
            )
            continue
        if existente is not None:
            if existente[1] == cliente_id:
                ctx.estado.vehiculos[patente] = existente[0]
                stats.reutilizados += len(filas)
                avisar_repetidas(patente, filas)
                continue
            rechazar_filas(
                patente, filas, "VEHICULO_PATENTE_DE_OTRO_CLIENTE",
                "la patente ya existe en el tenant asignada a otro cliente; no se reasigna",
            )
            continue

        vehiculo, avisos = preparar_vehiculo(combinar_filas_vehiculo(filas), ctx.ahora.year)
        reporte.avisos("vehiculo", avisos, linea=filas[0].line_number, id_origen=patente)
        avisar_repetidas(patente, filas)
        if not vehiculo.marca:
            reporte.contadores["vehiculos_sin_marca"] += 1
        if not patente_es_estandar(patente):
            reporte.contadores["vehiculos_patente_no_estandar"] += 1
        pendientes.append(VehiculoPendiente(str(uuid4()), cliente_id, vehiculo, filas))

    logging.info("fase=vehiculos: a_crear=%s%s", len(pendientes), " (dry-run)" if ctx.dry_run else "")

    def registrar_exitosos(exitosos: list[VehiculoPendiente]) -> None:
        for pending in exitosos:
            mapa.por_patente[pending.vehiculo.patente] = VehiculoRef(pending.vehiculo_id, pending.cliente_id, preexistente=False)
            stats.creados += 1
            stats.reutilizados += len(pending.filas) - 1

    if ctx.dry_run:
        registrar_exitosos(pendientes)
        return mapa

    def insertar(lote: list[VehiculoPendiente]) -> None:
        execute_traced(
            f"insertar_vehiculos_lote_{len(lote)}",
            lambda: ctx.supabase.table("vehiculos")
            .insert(
                [vehicle_payload(p.vehiculo, ctx.tenant_id, p.vehiculo_id, p.cliente_id) for p in lote],
                returning="minimal",
            )
            .execute(),
        )

    def al_fallar(pending: VehiculoPendiente, error: Exception) -> None:
        ctx.estado.vehiculos.pop(pending.vehiculo.patente, None)
        rechazar_filas(pending.vehiculo.patente, pending.filas, "VEHICULO_INSERCION_FALLIDA", describir_error(error))

    for lote in chunked(pendientes, ctx.batch_size):
        for pending in lote:
            ctx.estado.vehiculos[pending.vehiculo.patente] = pending.vehiculo_id
        ctx.guardar_estado()
        registrar_exitosos(insertar_con_aislamiento(lote, insertar, al_fallar))
        ctx.guardar_estado()
    return mapa


# --------------------------------------------------------------------------
# Operarios
# --------------------------------------------------------------------------


def separar_nombre(nombre_completo: str) -> tuple[str, str | None]:
    parts = nombre_completo.rsplit(" ", maxsplit=1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], None)


def clave_nombre_empleado(nombre: str | None, apellido: str | None) -> str:
    return normalizar_clave(f"{nombre or ''} {apellido or ''}")


def dni_ficticio_derivado(id_operario: str) -> str | None:
    if id_operario.isdigit() and int(id_operario) < ID_OPERARIO_MAX_DERIVABLE:
        return f"{PREFIJO_DNI_FICTICIO}{int(id_operario):06d}"
    return None


def preparar_operario(row: OperarioCsv, id_origen: str) -> tuple[OperarioImportable, list[Aviso]]:
    avisos: list[Aviso] = []
    nombre_completo = normalizar_texto(row.nombre)
    if nombre_completo is None:
        raise RegistroInvalido("OPERARIO_SIN_NOMBRE", "Nombre esta vacio")
    nombre, apellido = separar_nombre(nombre_completo)
    if apellido is None:
        # empleados.apellido es NOT NULL; se asigna despues de normalizar
        # porque normalizar_texto convierte el espacio en None.
        apellido = " "
        avisos.append(
            Aviso("OPERARIO_SIN_APELLIDO", "Nombre tiene una sola palabra; se usa un espacio como apellido")
        )

    dni_origen = normalizar_texto(row.dni)
    dni_digitos = re.sub(r"[\s.\-]", "", dni_origen) if dni_origen else None
    if dni_digitos is not None and is_dni(dni_digitos):
        dni: str | None = dni_digitos
        dni_ficticio = False
    else:
        dni = dni_ficticio_derivado(id_origen)
        dni_ficticio = True
        motivo = (
            "el DNI de origen no es valido"
            if dni_digitos is not None and dni_digitos != "0"
            else "operarios.csv no trae DNI"
        )
        avisos.append(Aviso("OPERARIO_DNI_FICTICIO", f"{motivo}; se asigna un DNI ficticio con prefijo 99"))

    valor_hora = leer_importe(row.importe_hora_costo, "ImporteHoraCosto", avisos)
    if valor_hora is not None:
        valor_hora = redondear(valor_hora)
        if valor_hora > MAX_PRECIO:
            avisos.append(Aviso("VALOR_NUMERICO_INVALIDO", "ImporteHoraCosto supera el maximo admitido; se omite"))
            valor_hora = None

    return (
        OperarioImportable(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            dni_ficticio=dni_ficticio,
            telefono=normalizar_texto(row.telefono),
            valor_hora=valor_hora,
        ),
        avisos,
    )


def procesar_operarios(ctx: Contexto, rows: list[OperarioCsv]) -> MapaOperarios:
    reporte = ctx.reporte
    stats = reporte.estadisticas["operario"]
    stats.leidos = len(rows)
    mapa = MapaOperarios()

    por_id: dict[str, list[OperarioCsv]] = defaultdict(list)
    for row in rows:
        id_origen = normalizar_id_origen(row.id_operario)
        if id_origen is None:
            reporte.rechazar("operario", "OPERARIO_SIN_ID", "IdOperario vacio o 0", linea=row.line_number)
            continue
        por_id[id_origen].append(row)

    empleados = listar_tabla(
        ctx.supabase,
        "consulta_empleados_taller",
        "empleados",
        "id,nombre,apellido,dni",
        ctx.filtro_tenant() + [("taller_id", ctx.taller_id)],
    )
    por_dni: dict[str, list[str]] = defaultdict(list)
    por_nombre: dict[str, list[str]] = defaultdict(list)
    for empleado in empleados:
        dni = re.sub(r"[\s.\-]", "", empleado.get("dni") or "")
        if dni:
            por_dni[dni].append(empleado["id"])
        por_nombre[clave_nombre_empleado(empleado.get("nombre"), empleado.get("apellido"))].append(empleado["id"])

    preparados: list[OperarioPendiente] = []
    for id_origen, filas in sorted(por_id.items(), key=lambda item: clave_orden_id(item[0])):
        if len(filas) > 1:
            for row in filas:
                reporte.rechazar(
                    "operario", "OPERARIO_ID_DUPLICADO", "IdOperario se repite en operarios.csv",
                    linea=row.line_number, id_origen=id_origen,
                )
            continue
        row = filas[0]
        migrado = ctx.estado.operarios.get(id_origen)
        if migrado is not None:
            mapa.por_id[id_origen] = migrado
            stats.ya_migrados += 1
            continue
        try:
            operario, avisos = preparar_operario(row, id_origen)
        except RegistroInvalido as error:
            reporte.rechazar("operario", error.codigo, error.motivo, linea=row.line_number, id_origen=id_origen)
            continue
        preparados.append(OperarioPendiente(str(uuid4()), id_origen, row, operario, avisos))

    nombres_origen = Counter(clave_nombre_empleado(p.operario.nombre, p.operario.apellido) for p in preparados)

    def reutilizar(pending: OperarioPendiente, empleado_id: str) -> None:
        mapa.por_id[pending.id_origen] = empleado_id
        ctx.estado.operarios[pending.id_origen] = empleado_id
        stats.reutilizados += 1

    def ambiguo(pending: OperarioPendiente, motivo: str) -> None:
        mapa.ambiguos.add(pending.id_origen)
        reporte.rechazar("operario", "OPERARIO_AMBIGUO", motivo, linea=pending.fila.line_number, id_origen=pending.id_origen)

    a_crear: list[OperarioPendiente] = []
    for pending in preparados:
        if pending.operario.dni is not None:
            coincidencias = por_dni.get(pending.operario.dni, [])
            if len(coincidencias) == 1:
                reutilizar(pending, coincidencias[0])
                continue
            if len(coincidencias) > 1:
                ambiguo(pending, "hay mas de un empleado del taller con el mismo DNI")
                continue
        clave = clave_nombre_empleado(pending.operario.nombre, pending.operario.apellido)
        coincidencias = por_nombre.get(clave, [])
        if coincidencias:
            if len(coincidencias) == 1 and nombres_origen[clave] == 1:
                reutilizar(pending, coincidencias[0])
                reporte.warning(
                    "operario", "OPERARIO_REUTILIZADO_POR_NOMBRE",
                    "se reutiliza el empleado del taller con el mismo nombre; no se modifican sus datos",
                    linea=pending.fila.line_number, id_origen=pending.id_origen,
                )
                continue
            ambiguo(pending, "hay mas de un empleado del taller u operario de origen con el mismo nombre")
            continue
        a_crear.append(pending)

    # IdOperario no numerico o >= 1.000.000: primer DNI ficticio libre, en orden
    # de IdOperario, solo para los que se crean (los demas se resolvieron arriba).
    ocupados = set(por_dni) | {p.operario.dni for p in a_crear if p.operario.dni is not None}
    siguiente = DNI_FICTICIO_MIN
    for pending in a_crear:
        if pending.operario.dni is not None:
            continue
        while str(siguiente) in ocupados:
            siguiente += 1
        if siguiente > DNI_FICTICIO_MAX:
            raise ErrorFatal("no quedan DNI ficticios libres en el rango 99000000-99999999")
        pending.operario.dni = str(siguiente)
        ocupados.add(pending.operario.dni)
        pending.avisos.append(
            Aviso(
                "OPERARIO_DNI_FICTICIO_NO_DERIVABLE",
                "IdOperario no permite derivar el DNI ficticio; se asigna el primer DNI libre del rango 99000000-99999999",
            )
        )

    for pending in a_crear:
        reporte.avisos("operario", pending.avisos, linea=pending.fila.line_number, id_origen=pending.id_origen)
        if pending.operario.dni_ficticio:
            reporte.contadores["operarios_dni_ficticio"] += 1
        if pending.operario.apellido == " ":
            reporte.contadores["operarios_sin_apellido"] += 1

    logging.info("fase=operarios: a_crear=%s%s", len(a_crear), " (dry-run)" if ctx.dry_run else "")

    def registrar_exitosos(exitosos: list[OperarioPendiente]) -> None:
        for pending in exitosos:
            mapa.por_id[pending.id_origen] = pending.empleado_id
            stats.creados += 1

    if ctx.dry_run:
        registrar_exitosos(a_crear)
        return mapa

    def insertar(lote: list[OperarioPendiente]) -> None:
        execute_traced(
            f"insertar_empleados_lote_{len(lote)}",
            lambda: ctx.supabase.table("empleados")
            .insert(
                [
                    {
                        "id": p.empleado_id,
                        "tenant_id": ctx.tenant_id,
                        "taller_id": ctx.taller_id,
                        "nombre": p.operario.nombre,
                        "apellido": p.operario.apellido,
                        "dni": p.operario.dni,
                        "telefono": p.operario.telefono,
                        "valor_hora": decimal_json(p.operario.valor_hora),
                        "salario": None,
                        "fecha_ingreso": None,
                    }
                    for p in lote
                ],
                returning="minimal",
            )
            .execute(),
        )

    def al_fallar(pending: OperarioPendiente, error: Exception) -> None:
        ctx.estado.operarios.pop(pending.id_origen, None)
        reporte.rechazar(
            "operario", "OPERARIO_INSERCION_FALLIDA", describir_error(error),
            linea=pending.fila.line_number, id_origen=pending.id_origen,
        )

    for lote in chunked(a_crear, ctx.batch_size):
        for pending in lote:
            ctx.estado.operarios[pending.id_origen] = pending.empleado_id
        ctx.guardar_estado()
        registrar_exitosos(insertar_con_aislamiento(lote, insertar, al_fallar))
        ctx.guardar_estado()
    return mapa


# --------------------------------------------------------------------------
# Categorias
# --------------------------------------------------------------------------


def procesar_categorias(ctx: Contexto, tareas: Iterable[TareaCsv]) -> dict[str, str]:
    """Devuelve la clave normalizada de GrupoTarea -> categorias_arreglo.id."""
    reporte = ctx.reporte
    stats = reporte.estadisticas["categoria"]

    nombres: dict[str, tuple[str, int]] = {}
    for tarea in tareas:
        texto = normalizar_texto(tarea.grupo_tarea)
        if texto is not None:
            nombres.setdefault(normalizar_clave(texto), (texto, tarea.line_number))
    stats.leidos = len(nombres)

    def cargar_existentes() -> dict[str, list[tuple[str, str]]]:
        existentes: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for row in listar_tabla(ctx.supabase, "consulta_categorias", "categorias_arreglo", "id,nombre", ctx.filtro_tenant()):
            existentes[normalizar_clave(row.get("nombre") or "")].append((row["id"], row.get("nombre") or ""))
        return existentes

    def elegir(candidatos: list[tuple[str, str]], texto: str) -> str:
        return next((cid for cid, nombre in candidatos if nombre.casefold() == texto.casefold()), candidatos[0][0])

    existentes = cargar_existentes()
    mapa: dict[str, str] = {}
    pendientes: list[tuple[str, str, str, int]] = []
    for clave, (texto, linea) in nombres.items():
        migrado = ctx.estado.categorias.get(clave)
        if migrado is not None:
            mapa[clave] = migrado
            stats.ya_migrados += 1
            continue
        candidatos = existentes.get(clave)
        if candidatos:
            mapa[clave] = ctx.estado.categorias[clave] = elegir(candidatos, texto)
            stats.reutilizados += 1
            continue
        pendientes.append((str(uuid4()), clave, texto, linea))

    def registrar_exitosos(exitosos: list[tuple[str, str, str, int]]) -> None:
        for categoria_id, clave, _, _ in exitosos:
            mapa[clave] = categoria_id
            stats.creados += 1
            reporte.contadores["categorias_creadas"] += 1

    if ctx.dry_run:
        registrar_exitosos(pendientes)
        return mapa

    fallidas: list[tuple[tuple[str, str, str, int], Exception]] = []

    def insertar(lote: list[tuple[str, str, str, int]]) -> None:
        execute_traced(
            f"insertar_categorias_lote_{len(lote)}",
            lambda: ctx.supabase.table("categorias_arreglo")
            .insert(
                [{"id": categoria_id, "tenant_id": ctx.tenant_id, "nombre": texto} for categoria_id, _, texto, _ in lote],
                returning="minimal",
            )
            .execute(),
        )

    def al_fallar(pending: tuple[str, str, str, int], error: Exception) -> None:
        ctx.estado.categorias.pop(pending[1], None)
        fallidas.append((pending, error))

    for lote in chunked(pendientes, ctx.batch_size):
        for categoria_id, clave, _, _ in lote:
            ctx.estado.categorias[clave] = categoria_id
        ctx.guardar_estado()
        registrar_exitosos(insertar_con_aislamiento(lote, insertar, al_fallar))
        ctx.guardar_estado()

    if fallidas:
        # Una insercion concurrente puede chocar con el indice unico
        # (tenant_id, lower(nombre)): se vuelve a leer y se reutiliza.
        existentes = cargar_existentes()
        for (_, clave, texto, linea), error in fallidas:
            candidatos = existentes.get(clave)
            if candidatos:
                mapa[clave] = ctx.estado.categorias[clave] = elegir(candidatos, texto)
                stats.reutilizados += 1
            else:
                reporte.rechazar(
                    "categoria", "CATEGORIA_INSERCION_FALLIDA", describir_error(error),
                    linea=linea, referencias=formatear_referencias(GrupoTarea=texto),
                )
        ctx.guardar_estado()
    return mapa


# --------------------------------------------------------------------------
# Repuestos, productos y stock
# --------------------------------------------------------------------------


def es_repuesto_utilizado(fila: RepuestoCsv) -> bool:
    return normalizar_clave(normalizar_texto(fila.estado) or "") == ESTADO_REPUESTO_IMPORTADO


def calcular_importes_repuesto(fila: RepuestoCsv) -> tuple[ValoresRepuesto, list[Aviso]]:
    """Venta: PrecioTotal llevado a final con IVA_ORIGEN. Costo: CostoReal por unidad, como viene."""
    avisos: list[Aviso] = []
    codigo_error = "REPUESTO_VALOR_FUERA_DE_RANGO"
    try:
        cantidad = parse_decimal(fila.cantidad)
    except ValueError:
        cantidad = None
    if cantidad is None or cantidad <= 0:
        raise RegistroInvalido("REPUESTO_CANTIDAD_INVALIDA", "Cantidad falta, no es un numero o no es mayor que cero")
    if cantidad > MAX_ENTERO:
        raise RegistroInvalido(codigo_error, f"Cantidad supera {MAX_ENTERO}")
    fraccionaria = cantidad != cantidad.to_integral_value()

    neto = leer_importe(fila.precio_total, "PrecioTotal", avisos, negativo_es_error=True, codigo_error=codigo_error)
    costo = leer_importe(fila.costo_real, "CostoReal", avisos, negativo_es_error=True, codigo_error=codigo_error)
    if neto is None:
        avisos.append(Aviso("REPUESTO_SIN_IMPORTE_VENTA", "PrecioTotal es 0 o falta; se importa con subtotal 0"))
        importe = precio_unitario = Decimal("0.00")
    else:
        importe = validar_precio(redondear(con_iva_origen(neto)), "PrecioTotal con IVA", codigo_error)
        precio_unitario = redondear(con_iva_origen(neto) / cantidad)
    costo_unitario = redondear(costo) if costo is not None else None
    if costo_unitario is not None:
        validar_precio(costo_unitario, "CostoReal", codigo_error)
    return (
        ValoresRepuesto(
            cantidad=cantidad,
            importe_venta=importe,
            precio_unitario=precio_unitario,
            costo_unitario=costo_unitario or None,
            cantidad_fraccionaria=fraccionaria,
            sin_importe_venta=neto is None,
        ),
        avisos,
    )


def planificar_repuesto(fila: RepuestoCsv, id_ot: str, id_renglon: str) -> RepuestoPlanificado:
    """Calcula importes e identifica el producto: Codigo si viene; si no, la descripcion."""
    valores, avisos = calcular_importes_repuesto(fila)
    codigo = normalizar_codigo_producto(fila.codigo)
    descripcion = normalizar_texto(fila.descripcion)
    if codigo is not None:
        clave = f"codigo:{codigo.casefold()}"
        if descripcion is None:
            avisos.append(Aviso("REPUESTO_SIN_DESCRIPCION", "Descripcion vacia; el producto se nombra con su Codigo"))
    elif descripcion is not None:
        clave = f"descripcion:{normalizar_clave(descripcion)}"
    else:
        raise RegistroInvalido("REPUESTO_SIN_PRODUCTO", "el repuesto no trae Codigo ni Descripcion para identificar el producto")
    return RepuestoPlanificado(
        id_ot=id_ot,
        id_renglon=id_renglon,
        fila=fila,
        clave_producto=clave,
        codigo=codigo,
        nombre=descripcion or codigo or "",
        valores=valores,
        avisos=avisos,
    )


def repuestos_para_productos(repuestos: Iterable[RepuestoCsv], ots: set[str]) -> list[RepuestoPlanificado]:
    """Repuestos utilizados y validos de OTs importables. Los errores se informan con su OT."""
    planificados: list[RepuestoPlanificado] = []
    for fila in repuestos:
        id_ot = normalizar_id_origen(fila.id_ot)
        id_renglon = normalizar_id_origen(fila.id_renglon)
        if id_ot not in ots or id_renglon is None or not es_repuesto_utilizado(fila):
            continue
        try:
            planificados.append(planificar_repuesto(fila, id_ot, id_renglon))
        except RegistroInvalido:
            continue
    return planificados


def clave_codigo(codigo: str | None) -> str:
    return " ".join((codigo or "").split()).casefold()


def elegir_referencia(grupo: list[RepuestoPlanificado]) -> RepuestoPlanificado:
    """Aparicion mas reciente con precio o costo: precio y costo del mismo momento."""
    con_importes = [r for r in grupo if not r.valores.sin_importe_venta or r.valores.costo_unitario is not None]
    return (con_importes or grupo)[-1]


def producto_payload(pending: ProductoPendiente, tenant_id: str) -> dict[str, Any]:
    return {
        "id": pending.producto_id,
        "tenant_id": tenant_id,
        "codigo": pending.codigo,
        "nombre": pending.nombre,
        "marca": None,
        "modelo": None,
        "descripcion": None,
        "proveedor": None,
        "precio_unitario": decimal_json(pending.precio_unitario),
        "costo_unitario": decimal_json(pending.costo_unitario),
        "categorias": [],
        # Igual que un repuesto creado desde un arreglo: producto esporadico,
        # fuera del listado principal de inventario.
        "show_in_stock": False,
    }


def procesar_productos(ctx: Contexto, repuestos: list[RepuestoPlanificado]) -> dict[str, str]:
    """Crea los productos que faltan y su stock en TALLER_ID. Devuelve clave de producto -> stocks.id."""
    reporte = ctx.reporte
    stats = reporte.estadisticas["producto"]

    # Claves en orden de primera aparicion; cada grupo, de la mas antigua a la mas reciente.
    por_clave: dict[str, list[RepuestoPlanificado]] = defaultdict(list)
    for repuesto in sorted(repuestos, key=lambda r: r.orden):
        por_clave[repuesto.clave_producto].append(repuesto)
    stats.leidos = len(por_clave)

    # Sin Codigo de origen: MIG-<IdRepuesto> de la primera aparicion, con sufijo
    # -2, -3... si se repite. Es estable mientras el CSV solo sume OTs nuevas.
    usados = {clave_codigo(grupo[0].codigo) for grupo in por_clave.values() if grupo[0].codigo is not None}
    codigos: dict[str, str] = {}
    for clave, grupo in por_clave.items():
        if grupo[0].codigo is not None:
            codigos[clave] = grupo[0].codigo
            continue
        base = f"{PREFIJO_CODIGO_GENERADO}{normalizar_id_origen(grupo[0].fila.id_repuesto) or '0'}"
        codigo, sufijo = base, 2
        while clave_codigo(codigo) in usados:
            codigo, sufijo = f"{base}-{sufijo}", sufijo + 1
        usados.add(clave_codigo(codigo))
        codigos[clave] = codigo

    existentes: dict[str, list[str]] = defaultdict(list)
    for row in listar_tabla(ctx.supabase, "consulta_productos", "productos", "id,codigo", ctx.filtro_tenant()):
        existentes[clave_codigo(row.get("codigo"))].append(row["id"])

    contexto_reporte: dict[str, dict[str, Any]] = {}
    producto_ids: dict[str, str] = {}
    pendientes: list[ProductoPendiente] = []
    for clave, grupo in por_clave.items():
        codigo = codigos[clave]
        referencia = elegir_referencia(grupo)
        contexto_reporte[clave] = {
            "linea": referencia.fila.line_number,
            "id_origen": codigo,
            "referencias": formatear_referencias(IdRepuesto=normalizar_id_origen(referencia.fila.id_repuesto)),
        }
        migrado = ctx.estado.productos.get(clave)
        if migrado is not None:
            producto_ids[clave] = migrado
            stats.ya_migrados += 1
            continue
        coincidencias = existentes.get(clave_codigo(codigo), [])
        if len(coincidencias) == 1:
            producto_ids[clave] = ctx.estado.productos[clave] = coincidencias[0]
            stats.reutilizados += 1
            continue
        if coincidencias:
            reporte.rechazar(
                "producto", "PRODUCTO_AMBIGUO",
                "hay mas de un producto del tenant con el mismo codigo; las OTs con este repuesto no se importan",
                **contexto_reporte[clave],
            )
            continue
        costo = referencia.valores.costo_unitario
        if costo is None:
            # Sin CostoReal: el costo es lo que se cobro, para no inventar margen.
            costo = referencia.valores.precio_unitario
            reporte.contadores["productos_costo_desde_precio"] += 1
        if grupo[0].codigo is None:
            reporte.contadores["productos_codigo_generado"] += 1
        pendientes.append(
            ProductoPendiente(
                producto_id=str(uuid4()),
                clave=clave,
                codigo=codigo,
                # El nombre de la aparicion mas reciente.
                nombre=grupo[-1].nombre,
                precio_unitario=referencia.valores.precio_unitario,
                costo_unitario=costo,
                referencia=referencia,
            )
        )

    logging.info("fase=productos: a_crear=%s%s", len(pendientes), " (dry-run)" if ctx.dry_run else "")

    def registrar_exitosos(exitosos: list[ProductoPendiente]) -> None:
        for pending in exitosos:
            producto_ids[pending.clave] = pending.producto_id
            stats.creados += 1

    if ctx.dry_run:
        registrar_exitosos(pendientes)
    else:

        def insertar(lote: list[ProductoPendiente]) -> None:
            execute_traced(
                f"insertar_productos_lote_{len(lote)}",
                lambda: ctx.supabase.table("productos")
                .insert([producto_payload(pending, ctx.tenant_id) for pending in lote], returning="minimal")
                .execute(),
            )

        def al_fallar(pending: ProductoPendiente, error: Exception) -> None:
            ctx.estado.productos.pop(pending.clave, None)
            reporte.rechazar(
                "producto", "PRODUCTO_INSERCION_FALLIDA", describir_error(error), **contexto_reporte[pending.clave]
            )

        for lote in chunked(pendientes, ctx.batch_size):
            for pending in lote:
                ctx.estado.productos[pending.clave] = pending.producto_id
            ctx.guardar_estado()
            registrar_exitosos(insertar_con_aislamiento(lote, insertar, al_fallar))
            ctx.guardar_estado()

    # Un producto recien creado no puede tener stock: solo se consultan los demas.
    creados = {pending.clave for pending in pendientes}
    return procesar_stocks(ctx, producto_ids, [c for c in producto_ids if c not in creados], contexto_reporte)


def procesar_stocks(
    ctx: Contexto,
    producto_ids: dict[str, str],
    claves_a_consultar: list[str],
    contexto_reporte: dict[str, dict[str, Any]],
) -> dict[str, str]:
    """Stock de cada producto en TALLER_ID: cantidad, minimo y maximo en 0."""
    reporte = ctx.reporte

    def cargar(producto_ids_: Iterable[str]) -> dict[str, str]:
        return {
            row["producto_id"]: row["id"]
            for row in consultar_por_valores(
                ctx.supabase, "consulta_stocks", "stocks", "id,producto_id", "producto_id", producto_ids_,
                ctx.filtro_tenant() + [("taller_id", ctx.taller_id)],
            )
        }

    existentes = cargar(producto_ids[clave] for clave in claves_a_consultar)
    stocks: dict[str, str] = {}
    pendientes: list[tuple[str, str, str]] = []
    for clave, producto_id in producto_ids.items():
        if producto_id in existentes:
            stocks[clave] = existentes[producto_id]
        else:
            pendientes.append((str(uuid4()), clave, producto_id))

    def registrar_exitosos(exitosos: list[tuple[str, str, str]]) -> None:
        for stock_id, clave, _ in exitosos:
            stocks[clave] = stock_id
            reporte.contadores["stocks_creados"] += 1

    if ctx.dry_run:
        registrar_exitosos(pendientes)
        return stocks

    fallidos: list[tuple[tuple[str, str, str], Exception]] = []

    def insertar(lote: list[tuple[str, str, str]]) -> None:
        execute_traced(
            f"insertar_stocks_lote_{len(lote)}",
            lambda: ctx.supabase.table("stocks")
            .insert(
                [
                    {
                        "id": stock_id,
                        "tenant_id": ctx.tenant_id,
                        "taller_id": ctx.taller_id,
                        "producto_id": producto_id,
                        "cantidad": 0,
                        "stock_minimo": 0,
                        "stock_maximo": 0,
                    }
                    for stock_id, _, producto_id in lote
                ],
                returning="minimal",
            )
            .execute(),
        )

    def al_fallar(pending: tuple[str, str, str], error: Exception) -> None:
        fallidos.append((pending, error))

    for lote in chunked(pendientes, ctx.batch_size):
        registrar_exitosos(insertar_con_aislamiento(lote, insertar, al_fallar))

    if fallidos:
        # (taller_id, producto_id) es unico: una insercion concurrente se relee y se reutiliza.
        releidos = cargar(producto_id for (_, _, producto_id), _ in fallidos)
        for (_, clave, producto_id), error in fallidos:
            if producto_id in releidos:
                stocks[clave] = releidos[producto_id]
            else:
                reporte.rechazar(
                    "producto", "STOCK_INSERCION_FALLIDA",
                    f"no se pudo crear el stock del producto en el taller; las OTs con este repuesto no se importan: "
                    f"{describir_error(error)}",
                    **contexto_reporte[clave],
                )
    return stocks


# --------------------------------------------------------------------------
# Importes de tareas y total de la OT
# --------------------------------------------------------------------------


def validar_horas(value: Decimal, campo: str, avisos: list[Aviso]) -> Decimal:
    redondeado = redondear(value)
    if redondeado != value:
        avisos.append(Aviso("TAREA_HORAS_REDONDEADAS", f"{campo} tiene mas de 2 decimales; se redondea"))
    if redondeado > MAX_HORAS:
        raise RegistroInvalido("TAREA_VALOR_FUERA_DE_RANGO", f"{campo} supera {MAX_HORAS}")
    return redondeado


def validar_precio(value: Decimal, campo: str, codigo_error: str = "TAREA_VALOR_FUERA_DE_RANGO") -> Decimal:
    if value > MAX_PRECIO:
        raise RegistroInvalido(codigo_error, f"{campo} supera {MAX_PRECIO}")
    return value


def calcular_importes_tarea(tarea: TareaCsv) -> tuple[ValoresTarea, list[Aviso]]:
    """Aplica las reglas de venta y costo: la columna de total tiene prioridad.

    La venta se lleva a final con IVA_ORIGEN; el costo se conserva como viene.
    """
    avisos: list[Aviso] = []

    def leer(value: str | None, campo: str) -> Decimal | None:
        return leer_importe(value, campo, avisos, negativo_es_error=True)

    cant_venta = leer(tarea.cant_horas_venta, "CantHorasVenta")
    precio_venta = leer(tarea.precio_hora_venta, "PrecioHoraVenta")
    importe_venta = leer(tarea.importe_horas_venta, "ImporteHorasVenta")
    cant_costo = leer(tarea.cant_horas_costo, "CantHorasCosto")
    precio_costo = leer(tarea.precio_hora_costo, "PrecioHoraCosto")
    importe_costo = leer(tarea.importe_costo, "ImporteCosto")

    sin_importe_venta = False
    if importe_venta is not None:
        horas = validar_horas(cant_venta, "CantHorasVenta", avisos) if cant_venta is not None else Decimal("1")
        if horas == 0:
            horas = Decimal("1")
        precio = redondear(con_iva_origen(importe_venta) / horas)
        if precio_venta is not None and abs(precio_venta * horas - importe_venta) > TOLERANCIA_REDONDEO:
            avisos.append(
                Aviso(
                    "TAREA_PRECIO_E_IMPORTE_DIFIEREN",
                    "PrecioHoraVenta x CantHorasVenta difiere de ImporteHorasVenta; manda el importe",
                )
            )
    elif precio_venta is not None and cant_venta is not None:
        horas = validar_horas(cant_venta, "CantHorasVenta", avisos)
        precio = redondear(con_iva_origen(precio_venta))
    else:
        horas = validar_horas(cant_venta, "CantHorasVenta", avisos) if cant_venta is not None else Decimal("0")
        # Nunca NULL: el trigger aplicaria el valor hora actual del taller.
        precio = Decimal("0.00")
        sin_importe_venta = True
        avisos.append(
            Aviso("TAREA_SIN_IMPORTE_VENTA", "la tarea no trae importe ni precio de venta; se importa con subtotal 0")
        )
    validar_precio(precio, "precio_hora_facturada")

    horas_trabajadas = validar_horas(cant_costo, "CantHorasCosto", avisos) if cant_costo is not None else Decimal("0.00")
    costo_desconocido = False
    if importe_costo is not None:
        if horas_trabajadas == 0:
            horas_trabajadas = Decimal("1.00")
            avisos.append(Aviso("TAREA_COSTO_SIN_HORAS", "ImporteCosto sin CantHorasCosto; se toma 1 hora trabajada"))
        valor_hora: Decimal | None = redondear(importe_costo / horas_trabajadas)
    elif precio_costo is not None:
        valor_hora = redondear(precio_costo)
    else:
        # Costo historico desconocido: no se usa el valor hora actual del operario.
        valor_hora = None
        costo_desconocido = True
    if valor_hora is not None:
        validar_precio(valor_hora, "valor_hora_empleado")

    return (
        ValoresTarea(
            horas_facturadas=horas,
            precio_hora_facturada=precio,
            horas_trabajadas=horas_trabajadas,
            valor_hora_empleado=valor_hora,
            sin_importe_venta=sin_importe_venta,
            costo_desconocido=costo_desconocido,
        ),
        avisos,
    )


def calcular_precio_final(valores: Iterable[ValoresTarea], lineas: Iterable[LineaRepuestoPlan] = ()) -> Decimal:
    """Replica calcular_precio_final_arreglo: tareas con cantidad 1 mas repuestos."""
    servicios = sum((valor.horas_facturadas * 1 * valor.precio_hora_facturada for valor in valores), Decimal("0"))
    asignaciones = sum((linea.cantidad * linea.monto_unitario for linea in lineas), Decimal("0"))
    return redondear(servicios + asignaciones)


def valores_ajuste(diferencia: Decimal) -> ValoresTarea:
    return ValoresTarea(
        horas_facturadas=Decimal("1.00"),
        precio_hora_facturada=diferencia,
        horas_trabajadas=Decimal("0.00"),
        valor_hora_empleado=None,
    )


def planificar_total(
    valores: list[ValoresTarea], total: Decimal | None, lineas: list[LineaRepuestoPlan] | None = None
) -> tuple[Decimal | None, Decimal, Aviso | None]:
    """Devuelve (diferencia para la tarea de ajuste, precio_final esperado, aviso)."""
    lineas = lineas or []
    suma = calcular_precio_final(valores, lineas)
    if total is None:
        return None, suma, None
    total = redondear(total)
    if total - suma > TOLERANCIA_REDONDEO:
        diferencia = total - suma
        return (
            diferencia,
            calcular_precio_final([*valores, valores_ajuste(diferencia)], lineas),
            Aviso(
                "OT_AJUSTE_TOTAL_GENERADO",
                f"la suma de las tareas y repuestos ({formatear_decimal(suma)}) es menor que Total "
                f"({formatear_decimal(total)}); se agrega una tarea de ajuste por "
                f"{formatear_decimal(diferencia)} para saldar la diferencia",
            ),
        )
    if suma - total > TOLERANCIA_REDONDEO:
        return (
            None,
            suma,
            Aviso(
                "OT_TOTAL_MENOR_QUE_TAREAS",
                f"Total ({formatear_decimal(total)}) es menor que la suma de las tareas y repuestos "
                f"({formatear_decimal(suma)}); se usa la suma",
            ),
        )
    return None, suma, None


def absorber_redondeo(
    detalles: list[DetallePlan], lineas: list[LineaRepuestoPlan], total: Decimal | None
) -> bool:
    """Suma a una linea de cantidad u horas 1 los centavos que separan las lineas de Total.

    Llevar cada linea a final y a precio unitario deja centavos de diferencia con
    el Total de la OT. Dentro de la tolerancia, se corrigen en una linea para que
    el arreglo cierre exacto; si no hay una linea que los admita, quedan.
    """
    if total is None:
        return False
    diferencia = redondear(total) - calcular_precio_final([d.valores for d in detalles], lineas)
    if diferencia == 0 or abs(diferencia) > TOLERANCIA_REDONDEO:
        return False
    for linea in lineas:
        if linea.cantidad == 1 and linea.monto_unitario + diferencia > 0:
            linea.monto_unitario += diferencia
            return True
    for detalle in detalles:
        valores = detalle.valores
        if valores.horas_facturadas == 1 and valores.precio_hora_facturada + diferencia > 0:
            detalle.valores = replace(valores, precio_hora_facturada=valores.precio_hora_facturada + diferencia)
            return True
    return False


def calcular_precio_sin_iva(precio_final: Decimal) -> Decimal:
    return redondear(precio_final / (1 + IVA_RATE))


# --------------------------------------------------------------------------
# Ordenes de trabajo
# --------------------------------------------------------------------------


def construir_observaciones(orden: OrdenCsv) -> str | None:
    bloques = (
        ("Solicitud del cliente", orden.solicitud_cliente),
        ("Mano de obra", orden.mano_obra),
        ("Ampliación", orden.ampliacion),
        ("Otros", orden.otros),
        ("Referencia", orden.ref_a_cliente),
    )
    lineas = [f"{rotulo}: {texto}" for rotulo, valor in bloques if (texto := normalizar_texto(valor)) is not None]
    return "\n".join(lineas) or None


def construir_descripcion(descripciones_tareas: list[str], orden: OrdenCsv) -> str:
    if descripciones_tareas:
        return " | ".join(descripciones_tareas)
    return normalizar_texto(orden.solicitud_cliente) or DESCRIPCION_ARREGLO_FALLBACK


def construir_extra_data(
    orden: OrdenCsv, id_ot: str, migrado_at: datetime, modo_repuestos: str = MODO_REPUESTOS_PRODUCTOS
) -> dict[str, Any]:
    return {
        "migracion": {
            "origen": ORIGEN_MIGRACION,
            "id_ot": id_ot,
            "modo_repuestos": modo_repuestos,
            "id_cliente": normalizar_id_origen(orden.id_cliente),
            "id_vehiculo": normalizar_id_origen(orden.id_vehiculo),
            "patente": normalizar_patente(orden.patente),
            "id_deposito": normalizar_id_origen(orden.id_deposito),
            "id_tipo_vehiculo": normalizar_id_origen(orden.id_tipo_vehiculo),
            "id_marca": normalizar_id_origen(orden.id_marca),
            "id_modelo": normalizar_id_origen(orden.id_modelo),
            "version": normalizar_texto(orden.version),
            "anio": normalizar_texto(orden.anio),
            "total": texto_importe(orden.total),
            "facturado": parse_booleano(orden.facturado),
            "id_factura": normalizar_id_origen(orden.id_factura),
            "id_cliente_factura": normalizar_id_origen(orden.id_cliente_factura),
            "importe_a_facturar": texto_importe(orden.importe_a_facturar),
            "migrado_at": migrado_at.isoformat(timespec="seconds"),
        }
    }


def alternativas_por_id_vehiculo(ordenes: Iterable[OrdenCsv]) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """IdVehiculo -> patentes y patente -> IdVehiculo vistos en ordenesTrabajo.csv."""
    patentes_por_id: dict[str, set[str]] = defaultdict(set)
    ids_por_patente: dict[str, set[str]] = defaultdict(set)
    for orden in ordenes:
        id_vehiculo = normalizar_id_origen(orden.id_vehiculo)
        patente = normalizar_patente(orden.patente)
        if id_vehiculo is not None and patente is not None:
            patentes_por_id[id_vehiculo].add(patente)
            ids_por_patente[patente].add(id_vehiculo)
    return patentes_por_id, ids_por_patente


def resolver_vehiculo_ot(
    orden: OrdenCsv,
    vehiculos: MapaVehiculos,
    patentes_por_id: dict[str, set[str]],
) -> tuple[VehiculoRef, str, Aviso | None]:
    patente = normalizar_patente(orden.patente)
    if patente is not None:
        if patente in vehiculos.fallidos:
            raise RegistroInvalido(
                "OT_VEHICULO_NO_RESUELTO",
                f"el vehiculo de la patente no se importo (ver {vehiculos.fallidos[patente]} en vehiculos.csv)",
            )
        ref = vehiculos.por_patente.get(patente)
        if ref is not None:
            return ref, patente, None

    # Sin patente o con una que no existe (suele ser un error de tipeo en la OT): se busca
    # la unica patente existente que otras OTs asocian al mismo IdVehiculo.
    id_vehiculo = normalizar_id_origen(orden.id_vehiculo)
    candidatas = sorted(
        p
        for p in patentes_por_id.get(id_vehiculo or "", set())
        if p != patente and (p in vehiculos.por_patente or p in vehiculos.fallidos)
    )
    if len(candidatas) == 1 and candidatas[0] not in vehiculos.fallidos:
        (alternativa,) = candidatas
        motivo = (
            "la OT no trae patente; se usa la patente que otras OTs asocian al mismo IdVehiculo"
            if patente is None
            else f"la patente {patente} no existe; se usa {alternativa}, que otras OTs asocian al mismo IdVehiculo"
        )
        return vehiculos.por_patente[alternativa], alternativa, Aviso("OT_VEHICULO_RESUELTO_POR_ID_VEHICULO", motivo)

    if len(candidatas) > 1:
        detalle = "su IdVehiculo aparece con varias patentes"
    elif candidatas:
        detalle = (
            f"la patente de su IdVehiculo ({candidatas[0]}) no se importo "
            f"(ver {vehiculos.fallidos[candidatas[0]]} en vehiculos.csv)"
        )
    else:
        detalle = None
    if patente is not None:
        motivo = "la patente no existe en vehiculos.csv ni en el tenant"
        raise RegistroInvalido("OT_VEHICULO_NO_RESUELTO", f"{motivo} y {detalle}" if detalle else motivo)
    raise RegistroInvalido(
        "OT_SIN_PATENTE", f"la OT no trae patente y {detalle or 'IdVehiculo no permite resolver el vehiculo'}"
    )


def planificar_lineas_repuesto(
    repuestos: list[RepuestoPlanificado],
    productos: dict[str, str],
    fecha: datetime,
    avisos_repuestos: dict[str, list[Aviso]],
    contadores: Counter[str],
) -> list[LineaRepuestoPlan]:
    """Modo productos: una linea de asignacion por producto, con cantidad entera."""
    # B2Car admite una linea por producto en la asignacion del arreglo: las filas
    # del mismo producto se suman.
    grupos: dict[str, list[RepuestoPlanificado]] = {}
    for repuesto in repuestos:
        grupos.setdefault(repuesto.clave_producto, []).append(repuesto)
        if repuesto.valores.cantidad_fraccionaria:
            avisos_repuestos[repuesto.id_origen].append(
                Aviso(
                    "REPUESTO_CANTIDAD_FRACCIONARIA",
                    f"Cantidad {repuesto.valores.cantidad} no es entera y B2Car solo admite enteros; la linea se "
                    "importa con la cantidad redondeada (minimo 1) y el precio unitario se ajusta para conservar el importe",
                )
            )
            contadores["repuestos_cantidad_fraccionaria"] += 1
    lineas: list[LineaRepuestoPlan] = []
    for posicion, (clave, grupo) in enumerate(grupos.items()):
        stock_id = productos.get(clave)
        if stock_id is None:
            raise RegistroInvalido(
                "OT_REPUESTO_SIN_PRODUCTO",
                f"el producto del repuesto IdRenglon={grupo[0].id_renglon} no pudo crearse o es ambiguo "
                "(ver repuestosEnOT.csv)",
            )
        for repetido in grupo[1:]:
            avisos_repuestos[repetido.id_origen].append(
                Aviso(
                    "REPUESTO_AGRUPADO",
                    f"el producto ya aparece en la OT (IdRenglon={grupo[0].id_renglon}) y B2Car admite una linea "
                    "por producto; se suman cantidad e importe",
                )
            )
            contadores["repuestos_agrupados"] += 1
        cantidad_origen = sum((r.valores.cantidad for r in grupo), Decimal("0"))
        cantidad = max(1, int(cantidad_origen.to_integral_value(ROUND_HALF_UP)))
        if cantidad > MAX_ENTERO:
            raise RegistroInvalido("REPUESTO_VALOR_FUERA_DE_RANGO", f"la cantidad de un repuesto supera {MAX_ENTERO}")
        importe = sum((r.valores.importe_venta for r in grupo), Decimal("0"))
        # Hacia abajo: cantidad x monto nunca supera lo cobrado. El resto (gas
        # cobrado por gramo, por ejemplo) va a la tarea de ajuste si supera la tolerancia.
        monto_unitario = (importe / cantidad).quantize(CENTAVOS, ROUND_DOWN)
        lineas.append(
            LineaRepuestoPlan(
                linea_id=str(uuid4()),
                stock_id=stock_id,
                cantidad=cantidad,
                monto_unitario=validar_precio(monto_unitario, "monto_unitario", "REPUESTO_VALOR_FUERA_DE_RANGO"),
                created_at=fecha + timedelta(microseconds=posicion),
            )
        )
    return lineas


def formatear_cantidad(cantidad: Decimal) -> str:
    """3.50 -> "3,5"; 450.00 -> "450"."""
    return format(cantidad.normalize(), "f").replace(".", ",")


def detalle_de_repuesto(repuesto: RepuestoPlanificado, created_at: datetime, contadores: Counter[str]) -> DetallePlan:
    """Modo detalle: una linea de mano de obra de 1 hora por el importe de la fila.

    La cantidad de origen (incluso fraccionaria) va en la descripcion y el costo
    (CostoReal x Cantidad, o lo cobrado si no hay costo) en valor_hora_empleado.
    """
    valores = repuesto.valores
    if valores.costo_unitario is not None:
        costo = redondear(valores.costo_unitario * valores.cantidad)
    else:
        costo = valores.importe_venta
        contadores["repuestos_costo_desde_precio"] += 1
    descripcion = repuesto.nombre
    if valores.cantidad != 1:
        descripcion = f"{descripcion} x {formatear_cantidad(valores.cantidad)}"
    return DetallePlan(
        detalle_id=str(uuid4()),
        descripcion=descripcion,
        valores=ValoresTarea(
            horas_facturadas=Decimal("1.00"),
            precio_hora_facturada=valores.importe_venta,
            horas_trabajadas=Decimal("1.00"),
            valor_hora_empleado=validar_precio(costo, "CostoReal x Cantidad", "REPUESTO_VALOR_FUERA_DE_RANGO"),
            sin_importe_venta=valores.sin_importe_venta,
        ),
        empleado_id=None,
        categoria_id=None,
        created_at=created_at,
        id_tarea=None,
    )


def planificar_orden(
    ctx: Contexto,
    id_ot: str,
    orden: OrdenCsv,
    tareas: list[TareaPlanificada],
    clientes: dict[str, str],
    vehiculos: MapaVehiculos,
    operarios: MapaOperarios,
    categorias: dict[str, str],
    patentes_por_id: dict[str, set[str]],
    ids_por_patente: dict[str, set[str]],
    repuestos: list[RepuestoPlanificado],
    productos: dict[str, str],
) -> tuple[ArregloPlan, list[Aviso], dict[str, list[Aviso]], dict[str, list[Aviso]]]:
    """Construye el arreglo, sus detalles y sus repuestos. Devuelve avisos de la OT, por tarea y por repuesto."""
    reporte = ctx.reporte
    avisos: list[Aviso] = []
    avisos_tareas: dict[str, list[Aviso]] = {t.id_tarea: list(t.avisos) for t in tareas}
    avisos_repuestos: dict[str, list[Aviso]] = {r.id_origen: list(r.avisos) for r in repuestos}

    id_vehiculo = normalizar_id_origen(orden.id_vehiculo)
    patente_origen = normalizar_patente(orden.patente)
    vehiculo, patente, aviso_vehiculo = resolver_vehiculo_ot(orden, vehiculos, patentes_por_id)
    contadores: Counter[str] = Counter()
    if aviso_vehiculo is not None:
        avisos.append(aviso_vehiculo)
        contadores["ots_vehiculo_por_id_vehiculo"] += 1
    else:
        # Solo aplican cuando la patente de la OT es la que manda.
        if id_vehiculo is not None and len(patentes_por_id.get(id_vehiculo, set())) > 1:
            avisos.append(
                Aviso(
                    "OT_ID_VEHICULO_CON_VARIAS_PATENTES",
                    "el IdVehiculo aparece con varias patentes en ordenesTrabajo.csv; manda la patente de cada OT",
                )
            )
        if patente_origen is not None and len(ids_por_patente.get(patente_origen, set())) > 1:
            avisos.append(
                Aviso(
                    "OT_PATENTE_CON_VARIOS_ID_VEHICULO",
                    "la patente aparece con varios IdVehiculo en ordenesTrabajo.csv; manda la patente",
                )
            )
    if vehiculo.preexistente and patente not in vehiculos.patentes_csv:
        contadores["ots_vehiculo_preexistente"] += 1

    id_cliente = normalizar_id_origen(orden.id_cliente)
    cliente_id: str | None = None
    if id_cliente is not None:
        cliente_id = clientes.get(id_cliente)
        if cliente_id is None:
            avisos.append(
                Aviso(
                    "OT_CLIENTE_NO_RESUELTO",
                    "IdCliente no se pudo resolver; el arreglo toma el dueño actual del vehiculo",
                )
            )
        elif cliente_id != vehiculo.cliente_id:
            avisos.append(
                Aviso(
                    "OT_CLIENTE_DISTINTO_DEL_VEHICULO",
                    "el cliente de la OT difiere del dueño actual del vehiculo; se conserva el de la OT",
                )
            )
            contadores["ots_cliente_distinto_vehiculo"] += 1

    fechas_tareas: dict[str, datetime | None] = {}
    for tarea in tareas:
        try:
            fechas_tareas[tarea.id_tarea] = parse_fecha_origen(tarea.fila.fecha_realizado, ctx.ahora)
        except ValueError as error:
            fechas_tareas[tarea.id_tarea] = None
            avisos_tareas[tarea.id_tarea].append(Aviso("FECHA_INVALIDA", f"FechaRealizado_S {error}; se omite"))

    try:
        fecha = parse_fecha_origen(orden.fecha_ingreso, ctx.ahora)
    except ValueError as error:
        fecha = None
        avisos.append(Aviso("FECHA_INVALIDA", f"FechaIngreso_S {error}; se omite"))
    if fecha is None:
        validas = [valor for valor in fechas_tareas.values() if valor is not None]
        if not validas:
            raise RegistroInvalido("OT_SIN_FECHA", "la OT no tiene FechaIngreso_S valida ni tareas con fecha")
        fecha = min(validas)
        avisos.append(Aviso("OT_FECHA_DESDE_TAREAS", "FechaIngreso_S falta o es invalida; se usa la fecha de la primera tarea"))

    kilometraje = parse_entero_positivo(orden.kilometraje)
    if kilometraje is None:
        kilometrajes = [km for t in tareas if (km := parse_entero_positivo(t.fila.kilometraje)) is not None]
        if kilometrajes:
            kilometraje = max(kilometrajes)
            contadores["ots_kilometraje_desde_tareas"] += 1

    ordenadas = sorted(
        tareas,
        key=lambda t: (fechas_tareas[t.id_tarea] or fecha, clave_orden_id(t.id_tarea)),
    )
    detalles: list[DetallePlan] = []
    descripciones: list[str] = []
    for posicion, tarea in enumerate(ordenadas):
        fila = tarea.fila
        avisos_tarea = avisos_tareas[tarea.id_tarea]
        grupo = normalizar_texto(fila.grupo_tarea)
        descripcion = normalizar_texto(fila.descripcion)
        if descripcion is None:
            if grupo is not None:
                descripcion = grupo
                avisos_tarea.append(Aviso("TAREA_SIN_DESCRIPCION", "DescripcionTarea vacia; se usa GrupoTarea"))
            else:
                descripcion = DESCRIPCION_TAREA_FALLBACK
                avisos_tarea.append(
                    Aviso("TAREA_SIN_DESCRIPCION", "DescripcionTarea y GrupoTarea vacios; se usa una descripcion generica")
                )
        descripciones.append(descripcion)

        id_operario = normalizar_id_origen(fila.id_operario)
        empleado_id = None
        if id_operario is None:
            contadores["tareas_sin_operario_en_origen"] += 1
        else:
            empleado_id = operarios.por_id.get(id_operario)
            if empleado_id is None:
                motivo = (
                    "el operario es ambiguo en el taller destino"
                    if id_operario in operarios.ambiguos
                    else "IdOperario no existe en operarios.csv o no pudo importarse"
                )
                avisos_tarea.append(Aviso("TAREA_OPERARIO_NO_RESUELTO", f"{motivo}; la tarea se importa sin empleado"))
                contadores["tareas_operario_no_resuelto"] += 1

        categoria_id = None
        if grupo is not None:
            categoria_id = categorias.get(normalizar_clave(grupo))
            if categoria_id is None:
                avisos_tarea.append(
                    Aviso("TAREA_CATEGORIA_NO_RESUELTA", "la categoria de GrupoTarea no pudo crearse; se importa sin categoria")
                )

        if tarea.valores.sin_importe_venta:
            contadores["tareas_sin_importe_venta"] += 1
        if tarea.valores.costo_desconocido:
            contadores["tareas_costo_desconocido"] += 1
        detalles.append(
            DetallePlan(
                detalle_id=str(uuid4()),
                descripcion=descripcion,
                valores=tarea.valores,
                empleado_id=empleado_id,
                categoria_id=categoria_id,
                created_at=(fechas_tareas[tarea.id_tarea] or fecha) + timedelta(microseconds=posicion),
                id_tarea=tarea.id_tarea,
            )
        )

    ordenados = sorted(repuestos, key=lambda r: r.orden)
    contadores["repuestos_sin_importe_venta"] += sum(1 for r in ordenados if r.valores.sin_importe_venta)
    lineas: list[LineaRepuestoPlan] = []
    if ctx.modo_repuestos == MODO_REPUESTOS_DETALLE:
        # Despues de las tareas y antes de la tarea de ajuste.
        base = detalles[-1].created_at if detalles else fecha
        for posicion, repuesto in enumerate(ordenados, start=1):
            detalles.append(detalle_de_repuesto(repuesto, base + timedelta(microseconds=posicion), contadores))
    else:
        lineas = planificar_lineas_repuesto(ordenados, productos, fecha, avisos_repuestos, contadores)

    total = leer_importe(orden.total, "Total", avisos)
    if absorber_redondeo(detalles, lineas, total):
        contadores["ots_centavos_de_redondeo_absorbidos"] += 1
    diferencia, esperado, aviso_total = planificar_total([d.valores for d in detalles], total, lineas)
    if aviso_total is not None:
        avisos.append(aviso_total)
        if aviso_total.codigo == "OT_TOTAL_MENOR_QUE_TAREAS":
            contadores["ots_total_menor_que_tareas"] += 1
    if diferencia is not None:
        validar_precio(diferencia, "la diferencia con Total")
        ultimo = detalles[-1].created_at if detalles else fecha
        detalles.append(
            DetallePlan(
                detalle_id=str(uuid4()),
                descripcion=DESCRIPCION_AJUSTE_TOTAL,
                valores=valores_ajuste(diferencia),
                empleado_id=None,
                categoria_id=None,
                created_at=ultimo + timedelta(microseconds=1),
                id_tarea=None,
                es_ajuste=True,
            )
        )

    reporte.contadores.update(contadores)
    id_deposito = normalizar_id_origen(orden.id_deposito)
    if id_deposito is not None:
        reporte.depositos.add(id_deposito)

    plan = ArregloPlan(
        arreglo_id=str(uuid4()),
        id_ot=id_ot,
        orden=orden,
        referencias=formatear_referencias(IdOT=id_ot, IdVehiculo=id_vehiculo, IdCliente=id_cliente, patente=patente),
        vehiculo_id=vehiculo.vehiculo_id,
        cliente_id=cliente_id,
        fecha=fecha,
        kilometraje=kilometraje,
        descripcion=construir_descripcion(descripciones, orden),
        observaciones=construir_observaciones(orden),
        precio_final=esperado,
        extra_data=construir_extra_data(orden, id_ot, ctx.ahora, ctx.modo_repuestos),
        detalles=detalles,
        tareas=tareas,
        lineas_repuesto=lineas,
        repuestos=repuestos,
    )
    return plan, avisos, avisos_tareas, avisos_repuestos


def arreglo_payload(plan: ArregloPlan, tenant_id: str, taller_id: str) -> dict[str, Any]:
    return {
        "id": plan.arreglo_id,
        "tenant_id": tenant_id,
        "taller_id": taller_id,
        "vehiculo_id": plan.vehiculo_id,
        "cliente_id": plan.cliente_id,
        "estado": "TERMINADO",
        "fecha": plan.fecha.isoformat(),
        "kilometraje_leido": plan.kilometraje,
        "combustible_leido": None,
        "descripcion": plan.descripcion,
        "observaciones": plan.observaciones,
        "precio_final": decimal_json(plan.precio_final),
        "precio_sin_iva": decimal_json(calcular_precio_sin_iva(plan.precio_final)),
        # Historial saldado sin movimientos financieros (decision de B2C-188).
        "total_cobrado": decimal_json(plan.precio_final),
        "es_facturable": False,
        "extra_data": plan.extra_data,
    }


def detalle_payload(detalle: DetallePlan, tenant_id: str, arreglo_id: str) -> dict[str, Any]:
    return {
        "id": detalle.detalle_id,
        "tenant_id": tenant_id,
        "arreglo_id": arreglo_id,
        "descripcion": detalle.descripcion,
        "cantidad": 1,
        "horas_facturadas": decimal_json(detalle.valores.horas_facturadas),
        "precio_hora_facturada": decimal_json(detalle.valores.precio_hora_facturada),
        "horas_trabajadas": decimal_json(detalle.valores.horas_trabajadas),
        "valor_hora_empleado": decimal_json(detalle.valores.valor_hora_empleado),
        "empleado_id": detalle.empleado_id,
        "categoria_arreglo_id": detalle.categoria_id,
        "created_at": detalle.created_at.isoformat(),
    }


def operacion_payload(plan: ArregloPlan, tenant_id: str, taller_id: str) -> dict[str, Any]:
    # Igual que rpc_set_asignacion_arreglo_linea: una operacion por arreglo con su fecha.
    return {
        "id": plan.operacion_id,
        "tenant_id": tenant_id,
        "tipo": "ASIGNACION_ARREGLO",
        "taller_id": taller_id,
        "fecha": plan.fecha.isoformat(),
    }


def linea_repuesto_payload(linea: LineaRepuestoPlan, operacion_id: str) -> dict[str, Any]:
    return {
        "id": linea.linea_id,
        "operacion_id": operacion_id,
        "stock_id": linea.stock_id,
        "cantidad": linea.cantidad,
        "monto_unitario": decimal_json(linea.monto_unitario),
        # Convencion de la app (la edicion calcula el movimiento de stock con este
        # valor), aunque el stock migrado no se descuenta y queda en 0.
        "delta_cantidad": -linea.cantidad,
        "categoria_arreglo_id": None,
        "empleado_id": None,
        "created_at": linea.created_at.isoformat(),
    }


def rechazar_tareas(ctx: Contexto, tareas: Iterable[TareaPlanificada], id_ot: str, motivo: str) -> None:
    for tarea in tareas:
        id_tarea, fila = tarea.id_tarea, tarea.fila
        ctx.reporte.rechazar(
            "tarea", "TAREA_OT_NO_IMPORTADA", motivo,
            linea=fila.line_number, id_origen=id_tarea, referencias=formatear_referencias(IdOT=id_ot),
        )


def rechazar_repuestos(ctx: Contexto, repuestos: Iterable[RepuestoPlanificado], id_ot: str, motivo: str) -> None:
    for repuesto in repuestos:
        ctx.reporte.rechazar(
            "repuesto", "REPUESTO_OT_NO_IMPORTADA", motivo,
            linea=repuesto.fila.line_number, id_origen=repuesto.id_origen, referencias=formatear_referencias(IdOT=id_ot),
        )


def buscar_arreglos_migrados(ctx: Contexto, ids_ot: Iterable[str]) -> dict[str, list[str]]:
    """Respaldo del estado: arreglos con el marcador de esta migracion en extra_data."""
    filas = consultar_por_valores(
        ctx.supabase,
        "consulta_marcador_arreglos",
        "arreglos",
        "id,extra_data",
        "extra_data->migracion->>id_ot",
        ids_ot,
        ctx.filtro_tenant() + [("extra_data->migracion->>origen", ORIGEN_MIGRACION)],
    )
    encontrados: dict[str, list[str]] = defaultdict(list)
    otros_modos: set[str] = set()
    for fila in filas:
        extra_data = fila.get("extra_data")
        migracion = extra_data.get("migracion") if isinstance(extra_data, dict) else None
        if isinstance(migracion, dict) and migracion.get("origen") == ORIGEN_MIGRACION and migracion.get("id_ot"):
            encontrados[str(migracion["id_ot"])].append(fila["id"])
            # Los arreglos de una version anterior no traen el modo.
            modo = migracion.get("modo_repuestos")
            if modo is not None and modo != ctx.modo_repuestos:
                otros_modos.add(str(modo))
    if otros_modos:
        raise ErrorFatal(
            f"hay arreglos migrados con --repuestos {', '.join(sorted(otros_modos))}; no se pueden mezclar modos. "
            "Usar el mismo modo o limpiar lo migrado"
        )
    return encontrados


def borrar_operaciones(ctx: Contexto, operacion_ids: list[str], id_ot: str | None = None) -> None:
    """Borra operaciones de asignacion de la migracion (vinculo y lineas caen en cascada)."""
    try:
        execute_traced(
            f"revertir_operaciones_{len(operacion_ids)}",
            lambda: ctx.supabase.table("operaciones")
            .delete()
            .in_("id", operacion_ids)
            .eq("tenant_id", ctx.tenant_id)
            .execute(),
        )
    except Exception as error:
        ots = f" de la OT {id_ot}" if id_ot else ""
        raise ErrorFatal(
            f"no se pudieron borrar las operaciones de repuestos{ots} ({', '.join(operacion_ids)}); "
            f"eliminarlas manualmente: {describir_error(error)}"
        ) from error


def compensar_arreglo(ctx: Contexto, arreglo_id: str, id_ot: str) -> None:
    """Borra un arreglo creado por la migracion y su operacion de repuestos.

    Los detalles caen en cascada con el arreglo, pero la operacion no: se borra
    primero por su ID derivado, aunque el corte haya ocurrido antes de vincularla.
    """
    borrar_operaciones(ctx, [operacion_id_de_arreglo(arreglo_id)], id_ot)
    try:
        execute_traced(
            f"revertir_arreglo_ot_{id_ot}",
            lambda: ctx.supabase.table("arreglos")
            .delete()
            .eq("id", arreglo_id)
            .eq("tenant_id", ctx.tenant_id)
            .execute(),
        )
    except Exception as error:
        raise ErrorFatal(
            f"no se pudo borrar el arreglo {arreglo_id} de la OT {id_ot} sin tareas; "
            f"eliminarlo manualmente: {describir_error(error)}"
        ) from error
    ctx.estado.ordenes.pop(id_ot, None)


def empaquetar_por_ot(
    planes: list[ArregloPlan], batch_size: int, filas_de: Callable[[ArregloPlan], int] = lambda plan: len(plan.detalles)
) -> list[list[ArregloPlan]]:
    """Agrupa OTs completas por request; las lineas de una OT nunca se dividen."""
    paquetes: list[list[ArregloPlan]] = []
    actual: list[ArregloPlan] = []
    filas = 0
    for plan in planes:
        if actual and filas + filas_de(plan) > batch_size:
            paquetes.append(actual)
            actual, filas = [], 0
        actual.append(plan)
        filas += filas_de(plan)
    if actual:
        paquetes.append(actual)
    return paquetes


def insertar_detalles_por_ot(ctx: Contexto, planes: list[ArregloPlan]) -> list[ArregloPlan]:
    def insertar(grupo: list[ArregloPlan]) -> None:
        execute_traced(
            f"insertar_detalles_lote_{len(grupo)}_ots",
            lambda: ctx.supabase.table("detalle_arreglo")
            .insert(
                [detalle_payload(d, ctx.tenant_id, plan.arreglo_id) for plan in grupo for d in plan.detalles],
                returning="minimal",
            )
            .execute(),
        )

    def al_fallar(plan: ArregloPlan, error: Exception) -> None:
        compensar_arreglo(ctx, plan.arreglo_id, plan.id_ot)
        ctx.reporte.rechazar(
            "orden", "OT_DETALLES_FALLARON",
            f"no se pudieron insertar las tareas; se borro el arreglo: {describir_error(error)}",
            linea=plan.orden.line_number, id_origen=plan.id_ot, referencias=plan.referencias,
        )
        rechazar_tareas(ctx, plan.tareas, plan.id_ot, "fallo la insercion de las tareas de su OT")
        rechazar_repuestos(ctx, plan.repuestos, plan.id_ot, "fallo la insercion de las tareas de su OT")

    exitosos: list[ArregloPlan] = []
    for paquete in empaquetar_por_ot(planes, ctx.batch_size):
        exitosos.extend(insertar_con_aislamiento(paquete, insertar, al_fallar))
    return exitosos


def insertar_repuestos_por_ot(ctx: Contexto, planes: list[ArregloPlan]) -> list[ArregloPlan]:
    """Operacion, vinculo y lineas de cada arreglo. Un paquete que falla se revierte antes de dividirse."""

    def insertar(grupo: list[ArregloPlan]) -> None:
        try:
            execute_traced(
                f"insertar_operaciones_lote_{len(grupo)}_ots",
                lambda: ctx.supabase.table("operaciones")
                .insert([operacion_payload(plan, ctx.tenant_id, ctx.taller_id) for plan in grupo], returning="minimal")
                .execute(),
            )
            # El vinculo va antes que las lineas: sus triggers buscan el arreglo por el vinculo.
            execute_traced(
                f"insertar_asignaciones_lote_{len(grupo)}_ots",
                lambda: ctx.supabase.table("operaciones_asignacion_arreglo")
                .insert(
                    [{"operacion_id": plan.operacion_id, "arreglo_id": plan.arreglo_id} for plan in grupo],
                    returning="minimal",
                )
                .execute(),
            )
            execute_traced(
                f"insertar_lineas_repuesto_lote_{len(grupo)}_ots",
                lambda: ctx.supabase.table("operaciones_lineas")
                .insert(
                    [linea_repuesto_payload(linea, plan.operacion_id) for plan in grupo for linea in plan.lineas_repuesto],
                    returning="minimal",
                )
                .execute(),
            )
        except Exception:
            borrar_operaciones(ctx, [plan.operacion_id for plan in grupo])
            raise

    def al_fallar(plan: ArregloPlan, error: Exception) -> None:
        compensar_arreglo(ctx, plan.arreglo_id, plan.id_ot)
        ctx.reporte.rechazar(
            "orden", "OT_REPUESTOS_FALLARON",
            f"no se pudieron insertar los repuestos; se borro el arreglo: {describir_error(error)}",
            linea=plan.orden.line_number, id_origen=plan.id_ot, referencias=plan.referencias,
        )
        rechazar_tareas(ctx, plan.tareas, plan.id_ot, "fallo la insercion de los repuestos de su OT")
        rechazar_repuestos(ctx, plan.repuestos, plan.id_ot, "fallo la insercion de los repuestos de su OT")

    exitosos: list[ArregloPlan] = []
    for paquete in empaquetar_por_ot(planes, ctx.batch_size, lambda plan: len(plan.lineas_repuesto)):
        exitosos.extend(insertar_con_aislamiento(paquete, insertar, al_fallar))
    return exitosos


def verificar_lote(ctx: Contexto, planes: list[ArregloPlan]) -> None:
    """Confirma que los triggers respetaron importes y costos enviados."""
    if not planes:
        return
    filas = consultar_por_valores(
        ctx.supabase, "verificacion_arreglos", "arreglos", "id,precio_final,total_cobrado", "id",
        [plan.arreglo_id for plan in planes], ctx.filtro_tenant(),
    )
    por_id = {fila["id"]: fila for fila in filas}
    for plan in planes:
        fila = por_id.get(plan.arreglo_id)
        if fila is None:
            raise ErrorFatal(f"el arreglo {plan.arreglo_id} de la OT {plan.id_ot} no se encontro despues de insertarlo")
        precio_final = decimal_desde_base(fila.get("precio_final")) or Decimal("0.00")
        if precio_final != plan.precio_final:
            try:
                execute_traced(
                    f"ajustar_total_cobrado_ot_{plan.id_ot}",
                    lambda: ctx.supabase.table("arreglos")
                    .update(
                        {
                            "total_cobrado": decimal_json(precio_final),
                            "precio_sin_iva": decimal_json(calcular_precio_sin_iva(precio_final)),
                        }
                    )
                    .eq("id", plan.arreglo_id)
                    .eq("tenant_id", ctx.tenant_id)
                    .execute(),
                )
            except Exception as error:
                raise ErrorFatal(
                    f"no se pudo dejar saldado el arreglo {plan.arreglo_id} de la OT {plan.id_ot}: {describir_error(error)}"
                ) from error
            ctx.reporte.warning(
                "orden", "OT_PRECIO_RECALCULADO_DIFIERE",
                f"la base recalculo precio_final ({formatear_decimal(precio_final)}) distinto del esperado "
                f"({formatear_decimal(plan.precio_final)}); total_cobrado se iguala al recalculado",
                linea=plan.orden.line_number, id_origen=plan.id_ot, referencias=plan.referencias,
            )
            plan.precio_final = precio_final

    verificar_detalles(ctx, planes)
    verificar_lineas_repuesto(ctx, planes)


def verificar_detalles(ctx: Contexto, planes: list[ArregloPlan]) -> None:
    enviados = {d.detalle_id: (plan, d) for plan in planes for d in plan.detalles}
    if not enviados:
        return
    detalles = consultar_por_valores(
        ctx.supabase,
        "verificacion_detalles",
        "detalle_arreglo",
        "id,valor_hora_empleado,precio_hora_facturada,horas_facturadas,horas_trabajadas",
        "arreglo_id",
        [plan.arreglo_id for plan in planes if plan.detalles],
        ctx.filtro_tenant(),
    )
    encontrados = {fila["id"]: fila for fila in detalles}
    for detalle_id, (plan, detalle) in enviados.items():
        fila = encontrados.get(detalle_id)
        if fila is None:
            raise ErrorFatal(f"el detalle {detalle_id} de la OT {plan.id_ot} no se encontro despues de insertarlo")
        if decimal_desde_base(fila.get("valor_hora_empleado")) != detalle.valores.valor_hora_empleado:
            raise ErrorFatal(
                f"la migracion {MIGRACION_REQUERIDA} no esta aplicada en la base destino: "
                f"detalle_arreglo.valor_hora_empleado no conserva el costo historico (OT {plan.id_ot}). "
                "Los arreglos ya insertados quedaron registrados en el archivo de estado."
            )
        for campo in ("precio_hora_facturada", "horas_facturadas", "horas_trabajadas"):
            if decimal_desde_base(fila.get(campo)) != getattr(detalle.valores, campo):
                raise ErrorFatal(
                    f"un trigger no contemplado modifico detalle_arreglo.{campo} (OT {plan.id_ot}, detalle {detalle_id})"
                )


def verificar_lineas_repuesto(ctx: Contexto, planes: list[ArregloPlan]) -> None:
    enviadas = {linea.linea_id: (plan, linea) for plan in planes for linea in plan.lineas_repuesto}
    if not enviadas:
        return
    filas = consultar_por_valores(
        ctx.supabase,
        "verificacion_lineas_repuesto",
        "operaciones_lineas",
        "id,stock_id,cantidad,monto_unitario",
        "operacion_id",
        [plan.operacion_id for plan in planes if plan.lineas_repuesto],
        [],
    )
    encontradas = {fila["id"]: fila for fila in filas}
    for linea_id, (plan, linea) in enviadas.items():
        fila = encontradas.get(linea_id)
        if fila is None:
            raise ErrorFatal(f"la linea de repuesto {linea_id} de la OT {plan.id_ot} no se encontro despues de insertarla")
        if (
            fila.get("stock_id") != linea.stock_id
            or fila.get("cantidad") != linea.cantidad
            or decimal_desde_base(fila.get("monto_unitario")) != linea.monto_unitario
        ):
            raise ErrorFatal(
                f"un trigger no contemplado modifico la linea de repuesto {linea_id} (OT {plan.id_ot})"
            )


def insertar_arreglos(ctx: Contexto, planes: list[ArregloPlan]) -> None:
    reporte = ctx.reporte
    stats_orden = reporte.estadisticas["orden"]
    stats_tarea = reporte.estadisticas["tarea"]
    stats_repuesto = reporte.estadisticas["repuesto"]

    def registrar_confirmados(confirmados: list[ArregloPlan]) -> None:
        for plan in confirmados:
            stats_orden.creados += 1
            stats_tarea.creados += len(plan.tareas)
            stats_repuesto.creados += len(plan.repuestos)
            if plan.tiene_ajuste:
                reporte.contadores["lineas_ajuste_total"] += 1
            reporte.importe_total_migrado += plan.precio_final

    if ctx.dry_run:
        registrar_confirmados(planes)
        return

    def insertar(lote: list[ArregloPlan]) -> None:
        execute_traced(
            f"insertar_arreglos_lote_{len(lote)}",
            lambda: ctx.supabase.table("arreglos")
            .insert([arreglo_payload(plan, ctx.tenant_id, ctx.taller_id) for plan in lote], returning="minimal")
            .execute(),
        )

    def al_fallar(plan: ArregloPlan, error: Exception) -> None:
        ctx.estado.ordenes.pop(plan.id_ot, None)
        reporte.rechazar(
            "orden", "OT_INSERCION_FALLIDA", describir_error(error),
            linea=plan.orden.line_number, id_origen=plan.id_ot, referencias=plan.referencias,
        )
        rechazar_tareas(ctx, plan.tareas, plan.id_ot, "fallo la insercion de su OT")
        rechazar_repuestos(ctx, plan.repuestos, plan.id_ot, "fallo la insercion de su OT")

    procesadas = 0
    for lote in chunked(planes, ctx.batch_size):
        for plan in lote:
            ctx.estado.ordenes[plan.id_ot] = plan.arreglo_id
        ctx.guardar_estado()
        creados = insertar_con_aislamiento(lote, insertar, al_fallar)
        con_detalles = [plan for plan in creados if plan.detalles]
        detalles_ok = {plan.arreglo_id for plan in insertar_detalles_por_ot(ctx, con_detalles)}
        sin_fallas = [plan for plan in creados if not plan.detalles or plan.arreglo_id in detalles_ok]
        con_repuestos = [plan for plan in sin_fallas if plan.lineas_repuesto]
        repuestos_ok = {plan.arreglo_id for plan in insertar_repuestos_por_ot(ctx, con_repuestos)}
        ctx.guardar_estado()
        confirmados = [plan for plan in sin_fallas if not plan.lineas_repuesto or plan.arreglo_id in repuestos_ok]
        try:
            verificar_lote(ctx, confirmados)
        finally:
            # Aunque la verificacion aborte, esos arreglos ya quedaron creados.
            registrar_confirmados(confirmados)
        procesadas += len(lote)
        logging.info("fase=arreglos_lotes: procesadas=%s/%s", procesadas, len(planes))


def procesar_ordenes(
    ctx: Contexto,
    ordenes: list[OrdenCsv],
    tareas: list[TareaCsv],
    clientes: dict[str, str],
    vehiculos: MapaVehiculos,
    operarios: MapaOperarios,
    categorias: dict[str, str],
    repuestos: list[RepuestoCsv] | None = None,
    productos: dict[str, str] | None = None,
) -> list[ArregloPlan]:
    repuestos = repuestos or []
    productos = productos or {}
    reporte = ctx.reporte
    stats_orden = reporte.estadisticas["orden"]
    stats_tarea = reporte.estadisticas["tarea"]
    stats_repuesto = reporte.estadisticas["repuesto"]
    stats_orden.leidos = len(ordenes)
    stats_tarea.leidos = len(tareas)
    stats_repuesto.leidos = len(repuestos)

    ordenes_por_id: dict[str, list[OrdenCsv]] = defaultdict(list)
    for orden in ordenes:
        id_ot = normalizar_id_origen(orden.id_ot)
        if id_ot is None:
            reporte.rechazar("orden", "OT_SIN_ID", "IdOT vacio o 0", linea=orden.line_number)
            continue
        ordenes_por_id[id_ot].append(orden)
    duplicadas = {id_ot for id_ot, filas in ordenes_por_id.items() if len(filas) > 1}
    for id_ot in duplicadas:
        for orden in ordenes_por_id[id_ot]:
            reporte.rechazar(
                "orden", "OT_ID_DUPLICADO", "IdOT se repite en ordenesTrabajo.csv",
                linea=orden.line_number, id_origen=id_ot,
            )
    validas = {id_ot: filas[0] for id_ot, filas in ordenes_por_id.items() if id_ot not in duplicadas}

    tareas_por_id: dict[str, list[TareaCsv]] = defaultdict(list)
    for tarea in tareas:
        id_tarea = normalizar_id_origen(tarea.id_tarea)
        if id_tarea is not None:
            tareas_por_id[id_tarea].append(tarea)

    # Por IdOT: todas sus filas de tareas, las que se pueden planificar y las
    # que tienen un error propio. Una tarea con error hace fallar su OT para no
    # dejar arreglos con importes incompletos.
    tareas_de: dict[str, list[TareaCsv]] = defaultdict(list)
    planificadas: dict[str, list[TareaPlanificada]] = defaultdict(list)
    errores_por_ot: dict[str, list[tuple[str | None, TareaCsv, RegistroInvalido]]] = defaultdict(list)

    for tarea in tareas:
        id_tarea = normalizar_id_origen(tarea.id_tarea)
        id_ot = normalizar_id_origen(tarea.id_ot)
        refs = formatear_referencias(IdOT=id_ot)
        if id_ot is None or (id_ot not in validas and id_ot not in duplicadas):
            reporte.rechazar(
                "tarea", "TAREA_OT_INEXISTENTE", "la OT de la tarea no existe en ordenesTrabajo.csv",
                linea=tarea.line_number, id_origen=id_tarea, referencias=refs,
            )
            continue
        if id_ot in duplicadas:
            reporte.rechazar(
                "tarea", "TAREA_OT_NO_IMPORTADA", "la OT tiene IdOT duplicado y no se importa",
                linea=tarea.line_number, id_origen=id_tarea, referencias=refs,
            )
            continue
        tareas_de[id_ot].append(tarea)
        if id_tarea is None:
            errores_por_ot[id_ot].append((None, tarea, RegistroInvalido("TAREA_SIN_ID", "IdTareaEnOT vacio o 0")))
        elif len(tareas_por_id[id_tarea]) > 1:
            errores_por_ot[id_ot].append(
                (id_tarea, tarea, RegistroInvalido("TAREA_ID_DUPLICADO", "IdTareaEnOT se repite en tareasEnOT.csv"))
            )
        else:
            try:
                valores, avisos = calcular_importes_tarea(tarea)
            except RegistroInvalido as error:
                errores_por_ot[id_ot].append((id_tarea, tarea, error))
                continue
            planificadas[id_ot].append(TareaPlanificada(id_tarea, tarea, valores, avisos))

    # Repuestos: misma regla que las tareas; ademas, solo se importan los
    # utilizados, que son los que suman al Total de la OT.
    repuestos_de: dict[str, list[RepuestoCsv]] = defaultdict(list)
    repuestos_planificados: dict[str, list[RepuestoPlanificado]] = defaultdict(list)
    errores_repuestos_por_ot: dict[str, list[tuple[str | None, RepuestoCsv, RegistroInvalido]]] = defaultdict(list)
    utilizados = [fila for fila in repuestos if es_repuesto_utilizado(fila)]
    renglones = Counter(
        (normalizar_id_origen(fila.id_ot), normalizar_id_origen(fila.id_renglon)) for fila in utilizados
    )
    for fila in repuestos:
        id_ot = normalizar_id_origen(fila.id_ot)
        id_renglon = normalizar_id_origen(fila.id_renglon)
        id_origen = f"{id_ot}-{id_renglon}" if id_ot is not None and id_renglon is not None else None
        refs = formatear_referencias(IdOT=id_ot, IdRepuesto=normalizar_id_origen(fila.id_repuesto))
        if not es_repuesto_utilizado(fila):
            reporte.warning(
                "repuesto", "REPUESTO_NO_UTILIZADO",
                f"Estado {normalizar_texto(fila.estado) or 'vacio'}; solo se importan los repuestos utilizados",
                linea=fila.line_number, id_origen=id_origen, referencias=refs,
            )
            reporte.contadores["repuestos_no_utilizados"] += 1
            continue
        if id_ot is None or (id_ot not in validas and id_ot not in duplicadas):
            reporte.rechazar(
                "repuesto", "REPUESTO_OT_INEXISTENTE", "la OT del repuesto no existe en ordenesTrabajo.csv",
                linea=fila.line_number, id_origen=id_origen, referencias=refs,
            )
            continue
        if id_ot in duplicadas:
            reporte.rechazar(
                "repuesto", "REPUESTO_OT_NO_IMPORTADA", "la OT tiene IdOT duplicado y no se importa",
                linea=fila.line_number, id_origen=id_origen, referencias=refs,
            )
            continue
        repuestos_de[id_ot].append(fila)
        if id_renglon is None:
            errores_repuestos_por_ot[id_ot].append((None, fila, RegistroInvalido("REPUESTO_SIN_ID", "IdRenglon vacio o 0")))
        elif renglones[(id_ot, id_renglon)] > 1:
            errores_repuestos_por_ot[id_ot].append(
                (id_origen, fila, RegistroInvalido("REPUESTO_ID_DUPLICADO", "IdOT e IdRenglon se repiten en repuestosEnOT.csv"))
            )
        else:
            try:
                repuestos_planificados[id_ot].append(planificar_repuesto(fila, id_ot, id_renglon))
            except RegistroInvalido as error:
                errores_repuestos_por_ot[id_ot].append((id_origen, fila, error))

    # OTs ya migradas: estado y, si falta, marcador en extra_data.
    migradas: dict[str, str] = {id_ot: ctx.estado.ordenes[id_ot] for id_ot in validas if id_ot in ctx.estado.ordenes}
    sin_estado = [id_ot for id_ot in validas if id_ot not in migradas]
    for id_ot, arreglo_ids in buscar_arreglos_migrados(ctx, sin_estado).items():
        if id_ot not in validas:
            continue
        migradas[id_ot] = sorted(arreglo_ids)[0]
        if len(arreglo_ids) > 1:
            reporte.warning(
                "orden", "OT_MARCADOR_DUPLICADO",
                "hay mas de un arreglo con el marcador de esta OT; se toma uno como migrado",
                linea=validas[id_ot].line_number, id_origen=id_ot,
            )

    if migradas:
        con_detalles = {
            fila["arreglo_id"]
            for fila in consultar_por_valores(
                ctx.supabase, "consulta_detalles_migrados", "detalle_arreglo", "id,arreglo_id", "arreglo_id",
                migradas.values(), ctx.filtro_tenant(),
            )
        }
        con_repuestos = {
            fila["arreglo_id"]
            for fila in consultar_por_valores(
                ctx.supabase, "consulta_repuestos_migrados", "operaciones_asignacion_arreglo", "operacion_id,arreglo_id",
                "arreglo_id", migradas.values(), [], orden="operacion_id",
            )
        }
        if ctx.modo_repuestos == MODO_REPUESTOS_DETALLE and con_repuestos:
            # Arreglos migrados en modo productos, tambien por una version
            # anterior del script que no guardaba el modo.
            raise ErrorFatal(
                f"hay {len(con_repuestos)} arreglos migrados con repuestos asignados como productos; no se pueden "
                "mezclar modos. Usar --repuestos productos o limpiar lo migrado"
            )
        for id_ot, arreglo_id in list(migradas.items()):
            orden = validas[id_ot]
            total = None
            try:
                total = parse_decimal(orden.total)
            except ValueError:
                pass
            tiene_detalles = arreglo_id in con_detalles
            tiene_repuestos = arreglo_id in con_repuestos
            if ctx.modo_repuestos == MODO_REPUESTOS_DETALLE:
                # Los repuestos tambien son detalles.
                faltan_lineas = bool(tareas_de.get(id_ot) or repuestos_de.get(id_ot)) and not tiene_detalles
            else:
                faltan_lineas = (bool(tareas_de.get(id_ot)) and not tiene_detalles) or (
                    bool(repuestos_de.get(id_ot)) and not tiene_repuestos
                )
            incompleto = faltan_lineas or (
                total is not None and total > TOLERANCIA_REDONDEO and not tiene_detalles and not tiene_repuestos
            )
            if incompleto:
                # Corte entre la insercion del arreglo y la de sus tareas o repuestos.
                if not ctx.dry_run:
                    compensar_arreglo(ctx, arreglo_id, id_ot)
                ctx.estado.ordenes.pop(id_ot, None)
                del migradas[id_ot]
                reporte.warning(
                    "orden", "ESTADO_ARREGLO_SIN_DETALLES",
                    "al arreglo migrado le faltan sus tareas o repuestos (corte a mitad de insercion); se vuelve a crear",
                    linea=orden.line_number, id_origen=id_ot,
                )
            else:
                ctx.estado.ordenes[id_ot] = arreglo_id
        ctx.guardar_estado()

    # Lo migrado es compatible con el modo: desde aca el estado lo fija.
    ctx.estado.modo_repuestos = ctx.modo_repuestos
    ctx.guardar_estado()

    patentes_por_id, ids_por_patente = alternativas_por_id_vehiculo(validas.values())
    planes: list[ArregloPlan] = []
    for indice, (id_ot, orden) in enumerate(sorted(validas.items(), key=lambda item: clave_orden_id(item[0])), start=1):
        ctx.informar_progreso("ordenes", indice)
        if id_ot in migradas:
            stats_orden.ya_migrados += 1
            stats_tarea.ya_migrados += len(tareas_de.get(id_ot, []))
            stats_repuesto.ya_migrados += len(repuestos_de.get(id_ot, []))
            continue

        errores = errores_por_ot.get(id_ot, [])
        errores_repuestos = errores_repuestos_por_ot.get(id_ot, [])
        if errores or errores_repuestos:
            for id_tarea, tarea, error in errores:
                reporte.rechazar(
                    "tarea", error.codigo, error.motivo,
                    linea=tarea.line_number, id_origen=id_tarea, referencias=formatear_referencias(IdOT=id_ot),
                )
            for id_repuesto_ot, fila, error in errores_repuestos:
                reporte.rechazar(
                    "repuesto", error.codigo, error.motivo,
                    linea=fila.line_number, id_origen=id_repuesto_ot, referencias=formatear_referencias(IdOT=id_ot),
                )
            if errores:
                id_tarea_error, tarea_error, error = errores[0]
                codigo, entidad = "OT_TAREA_INVALIDA", "una tarea"
                refs = formatear_referencias(IdOT=id_ot, IdTareaEnOT=id_tarea_error, linea_tarea=tarea_error.line_number)
            else:
                id_repuesto_error, repuesto_error, error = errores_repuestos[0]
                codigo, entidad = "OT_REPUESTO_INVALIDO", "un repuesto"
                refs = formatear_referencias(
                    IdOT=id_ot, IdRenglon=normalizar_id_origen(repuesto_error.id_renglon), linea_repuesto=repuesto_error.line_number
                )
            reporte.rechazar(
                "orden", codigo, f"{entidad} de la OT tiene un error ({error.codigo}); la OT no se importa",
                linea=orden.line_number, id_origen=id_ot, referencias=refs,
            )
            rechazar_tareas(ctx, planificadas.get(id_ot, []), id_ot, "otra linea de su OT tiene un error")
            rechazar_repuestos(ctx, repuestos_planificados.get(id_ot, []), id_ot, "otra linea de su OT tiene un error")
            continue

        tareas_ot = planificadas.get(id_ot, [])
        repuestos_ot = repuestos_planificados.get(id_ot, [])
        try:
            plan, avisos, avisos_tareas, avisos_repuestos = planificar_orden(
                ctx, id_ot, orden, tareas_ot, clientes, vehiculos, operarios, categorias, patentes_por_id, ids_por_patente,
                repuestos_ot, productos,
            )
        except RegistroInvalido as error:
            refs = formatear_referencias(
                IdOT=id_ot,
                IdVehiculo=normalizar_id_origen(orden.id_vehiculo),
                IdCliente=normalizar_id_origen(orden.id_cliente),
                patente=normalizar_patente(orden.patente),
            )
            reporte.rechazar("orden", error.codigo, error.motivo, linea=orden.line_number, id_origen=id_ot, referencias=refs)
            rechazar_tareas(ctx, tareas_ot, id_ot, f"su OT no se importa ({error.codigo})")
            rechazar_repuestos(ctx, repuestos_ot, id_ot, f"su OT no se importa ({error.codigo})")
            continue

        reporte.avisos("orden", avisos, linea=orden.line_number, id_origen=id_ot, referencias=plan.referencias)
        for tarea in tareas_ot:
            reporte.avisos(
                "tarea", avisos_tareas[tarea.id_tarea],
                linea=tarea.fila.line_number, id_origen=tarea.id_tarea, referencias=formatear_referencias(IdOT=id_ot),
            )
        for repuesto in repuestos_ot:
            reporte.avisos(
                "repuesto", avisos_repuestos[repuesto.id_origen],
                linea=repuesto.fila.line_number, id_origen=repuesto.id_origen, referencias=formatear_referencias(IdOT=id_ot),
            )
        planes.append(plan)

    logging.info("fase=arreglos: a_crear=%s%s", len(planes), " (dry-run)" if ctx.dry_run else "")
    insertar_arreglos(ctx, planes)
    return planes


# --------------------------------------------------------------------------
# Ejecucion
# --------------------------------------------------------------------------


def ids_ot_validos(ordenes: Iterable[OrdenCsv]) -> set[str]:
    conteo = Counter(id_ot for orden in ordenes if (id_ot := normalizar_id_origen(orden.id_ot)) is not None)
    return {id_ot for id_ot, cantidad in conteo.items() if cantidad == 1}


def ejecutar_migracion(ctx: Contexto, datos: DatosOrigen) -> None:
    validar_estado_en_base(ctx)
    clientes = procesar_clientes(ctx, datos.clientes)
    vehiculos = procesar_vehiculos(ctx, datos.vehiculos, clientes)
    operarios = procesar_operarios(ctx, datos.operarios)
    ots = ids_ot_validos(datos.ordenes)
    categorias = procesar_categorias(ctx, [t for t in datos.tareas if normalizar_id_origen(t.id_ot) in ots])
    productos: dict[str, str] = {}
    if ctx.modo_repuestos == MODO_REPUESTOS_PRODUCTOS:
        productos = procesar_productos(ctx, repuestos_para_productos(datos.repuestos, ots))
    procesar_ordenes(
        ctx, datos.ordenes, datos.tareas, clientes, vehiculos, operarios, categorias, datos.repuestos, productos
    )
    ctx.guardar_estado()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migra clientes, vehiculos, operarios, OTs, tareas y repuestos de un sistema externo a un tenant de B2Car."
    )
    parser.add_argument("directorio_csv", type=Path, help="Directorio con los seis CSV del sistema externo")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida, resuelve existentes y calcula importes sin escribir en la base ni en el estado",
    )
    parser.add_argument(
        "--repuestos",
        dest="modo_repuestos",
        choices=MODOS_REPUESTOS,
        default=MODO_REPUESTOS_PRODUCTOS,
        help=(
            "Como migrar repuestosEnOT.csv: 'productos' crea los productos con su stock en 0 y los asigna al arreglo; "
            "'detalle' los agrega como lineas de mano de obra del arreglo, sin crear productos (por defecto: productos)"
        ),
    )
    parser.add_argument(
        "--estado-path",
        type=Path,
        help="Archivo de estado (por defecto: <directorio_csv>/migracion_estado_<TENANT_ID>.json)",
    )
    parser.add_argument(
        "--reporte-path",
        type=Path,
        help="Reporte de incidencias (por defecto: <directorio_csv>/reporte_migracion[_dry_run].csv)",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_integer,
        default=DEFAULT_BATCH_SIZE,
        metavar="N",
        help="Cantidad maxima de filas por insert a Supabase (por defecto: 250)",
    )
    parser.add_argument("--encoding", default="utf-8-sig", help="Encoding de los CSV (por defecto: utf-8-sig)")
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
        help="Informa avance cada N vehiculos u OTs procesados (por defecto: 100)",
    )
    parser.add_argument(
        "--request-timeout",
        type=positive_integer,
        default=15,
        metavar="SEGUNDOS",
        help="Tiempo maximo por llamada HTTP a Supabase (por defecto: 15)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )
    # httpx registra cada URL en INFO, y los filtros in_ incluyen documentos.
    for nombre in ("httpx", "httpcore", "hpack"):
        logging.getLogger(nombre).setLevel(logging.WARNING)
    directorio: Path = args.directorio_csv
    if not directorio.is_dir():
        raise FileNotFoundError(f"no existe el directorio de CSV: {directorio}")
    reporte_path = args.reporte_path or directorio / (
        "reporte_migracion_dry_run.csv" if args.dry_run else "reporte_migracion.csv"
    )
    reporte = Reporte()
    logging.info("fase=inicio repuestos=%s%s", args.modo_repuestos, " (dry-run)" if args.dry_run else "")

    fatal = False
    try:
        tenant_id, taller_id = validate_config()
        datos = leer_archivos(localizar_archivos(directorio), args.encoding)
        estado = EstadoMigracion.cargar(
            args.estado_path or directorio / f"migracion_estado_{tenant_id}.json",
            tenant_id,
            taller_id,
            ORIGEN_MIGRACION,
            args.modo_repuestos,
        )
        supabase = create_supabase_client(args.request_timeout)
        validar_destino(supabase, tenant_id, taller_id)
        verificar_columnas(supabase)
        ctx = Contexto(
            supabase=supabase,
            tenant_id=tenant_id,
            taller_id=taller_id,
            dry_run=args.dry_run,
            batch_size=args.batch_size,
            reporte=reporte,
            estado=estado,
            progress_every=args.progress_every,
            modo_repuestos=args.modo_repuestos,
        )
        try:
            ejecutar_migracion(ctx, datos)
        finally:
            # Conserva lo ya insertado aunque un error fatal corte la ejecucion.
            ctx.guardar_estado()
    except Exception as error:
        fatal = True
        reporte.error("sistema", "ERROR_FATAL", describir_error(error) if not isinstance(error, ErrorFatal) else str(error))
        logging.error("la migracion no pudo continuar: %s", error if isinstance(error, ErrorFatal) else describir_error(error))

    escribir_reporte(reporte_path, reporte.incidencias)
    registrar_resumen(reporte, args.dry_run)
    logging.info(
        "finalizado: errores=%s warnings=%s reporte=%s%s",
        reporte.cantidad_errores,
        reporte.cantidad_warnings,
        reporte_path,
        " (dry-run)" if args.dry_run else "",
    )
    return 1 if fatal or reporte.cantidad_errores else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except FileNotFoundError as error:
        logging.basicConfig(level=logging.ERROR, format="%(levelname)s: %(message)s")
        logging.error(error)
        raise SystemExit(1) from error
