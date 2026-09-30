#!/usr/bin/env node
/**
 * Script de importación de productos y códigos para un tenant de B2Car.
 *
 * Lee un archivo Excel (.xlsx) con columnas configurables, valida los datos,
 * genera códigos automáticos para filas sin código (o las omite si se indica),
 * e inserta los productos en la tabla `productos` de Supabase para el tenant especificado.
 * También inicializa registros de stock para cada taller del tenant.
 *
 * Uso:
 *   node scripts/importar_productos_tenant.js --dry-run
 *   node scripts/importar_productos_tenant.js
 *   node scripts/importar_productos_tenant.js "archivo.xlsx" --batch-size 50 --verbose
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const { createClient } = require("@supabase/supabase-js");

// ============================================================================
// Configuración: archivo y mapeo de columnas del Excel
// Cambiar aquí los encabezados exactos según el archivo a importar.
// Poner null en las columnas opcionales que no existan en el Excel.
// ============================================================================

const DEFAULT_FILE = "reporte.xlsx";

const COLUMN_MAP = {
  nombre:      "Producto",    // Columna con el nombre/descripción del artículo
  codigo:      "Código",      // Columna con el código de producto (UsrCode)
  cantidad:    "Existencia",  // Columna con el stock inicial (null si no existe)
  stockMinimo: null,          // Columna con el stock mínimo   (null si no existe)
  stockMaximo: null,          // Columna con el stock máximo   (null si no existe)
};

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_BATCH_SIZE = 100;

const VALID_CATEGORIES = new Set([
  "Aceites y Lubricantes",
  "Filtros",
  "Frenos",
  "Suspensión",
  "Motor",
  "Eléctrico",
  "Carrocería",
  "Neumáticos",
  "Herramientas",
  "Accesorios",
]);

const STOP_WORDS = new Set([
  "de", "el", "la", "los", "las", "del", "un", "una",
  "y", "a", "en", "por", "con", "para", "al", "o",
]);

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", red: "\x1b[31m",
};

// ============================================================================
// Inferencia de Marca y Categorías
// ============================================================================

function inferMarca(nombre) {
  if (!nombre) return null;
  const u = nombre.toUpperCase();
  if (/\b(BRIDGESTONE|TURANZA|DUELER|ECOPIA|POTENZA|ALENZA)\b/.test(u)) return "BRIDGESTONE";
  if (/\b(FIRESTONE|DESTINATION|FIREHAWK|F-?600|F-?700|MULTIHAWK|FS\d{3}|FD\d{3}|T8\d{2})\b/.test(u)) return "FIRESTONE";
  if (/\b(PIRELLI|CINTURATO|SCORPION|P400|P7|P1)\b/.test(u)) return "PIRELLI";
  if (/\b(MICHELIN|PRIMACY|PILOT|ENERGY\s*SAVER)\b/.test(u)) return "MICHELIN";
  if (/\b(GOODYEAR|WRANGLER|EFFICIENTGRIP|ASSURANCE)\b/.test(u)) return "GOODYEAR";
  if (/\b(CONTINENTAL|CONTISPORT|CROSSCONTACT)\b/.test(u)) return "CONTINENTAL";
  if (/\b(YOKOHAMA|GEOLANDAR|BLUEARTH|ES32)\b/.test(u)) return "YOKOHAMA";
  if (/\b(FATE|FATECARGO|SENTIVA|MAXISPORT|EXIMIA)\b/.test(u)) return "FATE";
  if (/\b(HANKOOK|VENTUS|DYNAPRO|OPTIMO)\b/.test(u)) return "HANKOOK";
  if (/\b(KUMHO|ECSTA|SOLUS|ROAD\s*VENTURE)\b/.test(u)) return "KUMHO";
  if (/\b(DUNLOP|GRANDTREK|DIREZZA|SP\s*SPORT)\b/.test(u)) return "DUNLOP";
  if (/\b(NEXEN|ROADIAN|NFERA|NPRIZ)\b/.test(u)) return "NEXEN";
  if (/\bDAYTON\b/.test(u)) return "DAYTON";
  if (/\bOVATION\b/.test(u)) return "OVATION";
  if (/\bTERAFLEX\b/.test(u)) return "TERAFLEX";
  if (/\bENERGYWAY\b/.test(u)) return "ENERGYWAY";
  if (/\bMILLER\b/.test(u)) return "MILLER";
  return null;
}

function inferCategorias(nombre) {
  if (!nombre) return [];
  const u = nombre.toUpperCase();
  const cats = [];
  if (/\b\d{2,3}[\/\.]?\d{0,2}\s*R\s*\d{2}\b/i.test(u) || /\b\d{2}\.\d{2}R\d{2}\b/i.test(u) || /\bLT\d{3}/i.test(u) || /\b(CUBIERTA|NEUMATICO|PARCHE|LLANTA|TURANZA|DUELER|DESTINATION|ECOPIA|POTENZA|FIREHAWK|MULTIHAWK)\b/i.test(u)) cats.push("Neumáticos");
  if (/\b(ACEITE|LUBRICANTE|LIQUIDO\s+DE\s+FRENO|LIQUIDO\s+REFRIGERANTE|LIQUIDO\s+DE\s+DIRECCION|GRASA|AGUA\s+DESTILADA)\b/i.test(u)) cats.push("Aceites y Lubricantes");
  if (/\b(FILTRO|KIT\s+DE\s+FILTROS)\b/i.test(u)) cats.push("Filtros");
  if (/\b(FRENO|FRENOS|PASTILLA|PASTILLAS|DISCO|DISCOS|CAMPANA|CILINDRO\s+DE\s+FRENO)\b/i.test(u)) cats.push("Frenos");
  if (/\b(AMORTIGUADOR|AMORTIGUADORES|BIELETA|BIELETAS|CAZOLETA|PARRILLA|ROTULA|EXTREMO\s+DE\s+DIRECCION|PRECAP|BUJE|BUJES|TOPE\s+DE\s+AMORTIGUADOR)\b/i.test(u)) cats.push("Suspensión");
  if (/\b(MOTOR|PISTON|PISTONES|BIELA|BIELAS|VALVULA|VALVULAS|ARBOL\s+DE\s+LEVAS|CIGUEÑAL|BLOCK\s+DE\s+MOTOR|JUNTA|JUNTAS|TERMOSTATO|BOMBA\s+DE\s+AGUA|BOMBA\s+DE\s+ACEITE|DISTRIBUCION|CORREA|TAPA\s+DE\s+CILINDROS|CARTER|EMBRAGUE)\b/i.test(u)) cats.push("Motor");
  if (/\b(BATERIA|BATERIAS|BOBINA|BOBINAS|SENSOR|SENSORES|LAMPARA|LAMPARAS|ARRANQUE|ELECTRICO|ELECTROVENTILADOR|BUJIA|BUJIAS|BULBO|ARNES)\b/i.test(u)) cats.push("Eléctrico");
  if (/\b(CERRADURA|MANIJA|ALZA\s*CRISTAL|BUTACA|PUERTA|ESPEJO|OPTICA)\b/i.test(u)) cats.push("Carrocería");
  return cats.filter((cat) => VALID_CATEGORIES.has(cat));
}

// ============================================================================
// Generador de Códigos Automáticos
// ============================================================================

function generateProductCode(nombre, existingCodeSet) {
  const normalized = nombre
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/\.\,\-\_\:\;]/g, " ")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();

  const parts = normalized
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.slice(0, 3));

  let base = parts.slice(0, 3).join("-") || "PROD";

  for (let i = 1; i <= 9999; i++) {
    const candidate = `${base}-${String(i).padStart(3, "0")}`;
    if (!existingCodeSet.has(candidate.toUpperCase())) {
      existingCodeSet.add(candidate.toUpperCase());
      return candidate;
    }
  }
  throw new Error(`No se pudo generar un código único para: ${nombre}`);
}

// ============================================================================
// Carga de Entorno (.env.local fallback) y Credenciales
// ============================================================================

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[match[1]] = val;
    }
  }
  return env;
}

function resolveEnvConfig() {
  const envFile = loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    envFile.SUPABASE_URL ||
    envFile.NEXT_PUBLIC_SUPABASE_URL ||
    null;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    envFile.SUPABASE_SERVICE_ROLE_KEY ||
    envFile.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    null;

  const tenantId =
    process.env.TENANT_ID ||
    envFile.TENANT_ID ||
    null;

  return { supabaseUrl, serviceRoleKey, tenantId };
}

// ============================================================================
// Argumentos de Línea de Comandos
// ============================================================================

function printHelp() {
  console.log(`
${c.bold}Importador de Productos y Códigos para B2Car${c.reset}

${c.bold}USO:${c.reset}
  node scripts/importar_productos_tenant.js [archivo.xlsx] [opciones]

${c.bold}OPCIONES:${c.reset}
  --tenant-id <UUID>        ${c.cyan}ID del tenant de destino en Supabase${c.reset}
  --dry-run                 ${c.cyan}Simula la importación sin guardar cambios${c.reset}
  --actualizar-existentes   ${c.cyan}Si el código ya existe, actualiza en vez de omitir${c.reset}
  --solo-con-codigo         ${c.cyan}Omite productos sin código en el Excel${c.reset}
  --sin-inferir-marca       ${c.cyan}No infiere la marca automáticamente${c.reset}
  --sin-auto-categorias     ${c.cyan}No asigna categorías automáticas${c.reset}
  --sin-stock               ${c.cyan}No crea registros de stock${c.reset}
  --taller-id <UUID>        ${c.cyan}Inicializa stock solo para un taller específico${c.reset}
  --batch-size <N>          ${c.cyan}Tamaño de lote para Supabase (default: 100)${c.reset}
  --reporte <ruta>          ${c.cyan}Guardar informe JSON en la ruta indicada${c.reset}
  --verbose                 ${c.cyan}Muestra detalle de cada producto procesado${c.reset}
  --help                    ${c.cyan}Muestra esta ayuda${c.reset}

${c.bold}VARIABLES DE ENTORNO (o en .env.local):${c.reset}
  SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  TENANT_ID
`);
}

function parseArgs(argv) {
  const args = {
    filePath: null, tenantId: null, tallerId: null,
    dryRun: false, actualizarExistentes: false, soloConCodigo: false,
    inferirMarca: true, inferirCategorias: true, inicializarStock: true,
    batchSize: DEFAULT_BATCH_SIZE, reportePath: null, verbose: false,
  };

  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { printHelp(); process.exit(0); }
    else if (arg === "--dry-run")               args.dryRun = true;
    else if (arg === "--actualizar-existentes") args.actualizarExistentes = true;
    else if (arg === "--solo-con-codigo")       args.soloConCodigo = true;
    else if (arg === "--sin-inferir-marca")     args.inferirMarca = false;
    else if (arg === "--sin-auto-categorias")   args.inferirCategorias = false;
    else if (arg === "--sin-stock")             args.inicializarStock = false;
    else if (arg === "--verbose")               args.verbose = true;
    else if (arg === "--tenant-id" && i + 1 < argv.length) args.tenantId = argv[++i];
    else if (arg.startsWith("--tenant-id="))   args.tenantId = arg.split("=")[1];
    else if (arg === "--taller-id" && i + 1 < argv.length) args.tallerId = argv[++i];
    else if (arg.startsWith("--taller-id="))   args.tallerId = arg.split("=")[1];
    else if (arg === "--batch-size" && i + 1 < argv.length) args.batchSize = parseInt(argv[++i], 10) || DEFAULT_BATCH_SIZE;
    else if (arg === "--reporte" && i + 1 < argv.length) args.reportePath = argv[++i];
    else if (!arg.startsWith("-")) positional.push(arg);
    else console.warn(`${c.yellow}Aviso: argumento desconocido '${arg}' (ignorado)${c.reset}`);
  }

  args.filePath = positional[0] || null;
  return args;
}

// ============================================================================
// Lectura del Excel
// ============================================================================

async function readExcelFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo Excel no existe: ${filePath}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet(1);
  if (!ws) throw new Error("El archivo Excel no contiene hojas de cálculo.");

  // Mapear encabezados del COLUMN_MAP a índices de columna
  const colIndex = { nombre: null, codigo: null, cantidad: null, stockMinimo: null, stockMaximo: null };
  const headerRow = ws.getRow(1);
  for (let i = 1; i <= ws.columnCount; i++) {
    const header = String(headerRow.getCell(i).value ?? "").trim();
    for (const [key, expectedHeader] of Object.entries(COLUMN_MAP)) {
      if (expectedHeader && header === expectedHeader) {
        colIndex[key] = i;
      }
    }
  }

  // Validar columnas obligatorias
  if (!colIndex.nombre) throw new Error(`Columna obligatoria no encontrada: "${COLUMN_MAP.nombre}"`);
  if (!colIndex.codigo) throw new Error(`Columna obligatoria no encontrada: "${COLUMN_MAP.codigo}"`);

  const readStr = (row, idx) => {
    if (!idx) return "";
    const val = row.getCell(idx).value;
    return val != null ? String(val).trim() : "";
  };

  const readNum = (row, idx) => {
    if (!idx) return null;
    const val = row.getCell(idx).value;
    if (val == null || val === "") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const rows = [];
  for (let rIdx = 2; rIdx <= ws.rowCount; rIdx++) {
    const row = ws.getRow(rIdx);
    const nombre   = readStr(row, colIndex.nombre);
    const rawCodigo = readStr(row, colIndex.codigo);
    if (!nombre && !rawCodigo) continue; // fila vacía
    rows.push({
      rowNumber: rIdx,
      nombre,
      rawCodigo,
      rawCantidad:    readNum(row, colIndex.cantidad),
      rawStockMinimo: readNum(row, colIndex.stockMinimo),
      rawStockMaximo: readNum(row, colIndex.stockMaximo),
    });
  }

  return rows;
}

// ============================================================================
// Helpers de Stock
// ============================================================================

function sanitizeStock(value) {
  return Math.max(0, value ?? 0);
}

function buildStockRecord(tenantId, tallerId, productoId, { rawCantidad, rawStockMinimo, rawStockMaximo }) {
  return {
    tenant_id: tenantId,
    taller_id: tallerId,
    producto_id: productoId,
    cantidad:    sanitizeStock(rawCantidad),
    stock_minimo: sanitizeStock(rawStockMinimo),
    stock_maximo: sanitizeStock(rawStockMaximo),
  };
}

// ============================================================================
// Lógica Principal
// ============================================================================

async function main() {
  const args = parseArgs(process.argv);
  const envConfig = resolveEnvConfig();

  const tenantId = args.tenantId || envConfig.tenantId;
  const filePath = path.resolve(process.cwd(), args.filePath || DEFAULT_FILE);

  console.log(`\n${c.bold}${c.cyan}=== Importador de Productos para B2Car ===${c.reset}\n`);
  if (args.dryRun) {
    console.log(`${c.yellow}${c.bold}MODO DRY-RUN: No se modificará la base de datos.${c.reset}\n`);
  }

  // 1. Validar tenant
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !uuidRegex.test(tenantId)) {
    console.error(`${c.red}Error: TENANT_ID no provisto o inválido.${c.reset}`);
    process.exit(1);
  }
  if (!envConfig.supabaseUrl) {
    console.error(`${c.red}Error: Falta SUPABASE_URL.${c.reset}`);
    process.exit(1);
  }
  if (!args.dryRun && !envConfig.serviceRoleKey) {
    console.error(`${c.red}Error: Falta SUPABASE_SERVICE_ROLE_KEY.${c.reset}`);
    process.exit(1);
  }

  const supabase = createClient(
    envConfig.supabaseUrl,
    envConfig.serviceRoleKey || "dummy-for-dry-run",
    { auth: { persistSession: false } }
  );

  // 2. Verificar tenant en BD
  let tenantNombre = "(Sin nombre)";
  if (envConfig.serviceRoleKey) {
    console.log(`Verificando tenant ${c.bold}${tenantId}${c.reset}...`);
    const { data, error } = await supabase.from("tenants").select("id, nombre").eq("id", tenantId).maybeSingle();
    if (error) console.warn(`${c.yellow}Aviso: ${error.message}${c.reset}`);
    else if (!data) { console.error(`${c.red}Error: Tenant no encontrado.${c.reset}`); process.exit(1); }
    else { tenantNombre = data.nombre || tenantNombre; console.log(`${c.green}✔ Tenant:${c.reset} ${tenantNombre}\n`); }
  }

  // 3. Leer Excel
  console.log(`Leyendo: ${c.bold}${filePath}${c.reset}...`);
  const rawRows = await readExcelFile(filePath);
  console.log(`${c.green}✔ Filas leídas:${c.reset} ${rawRows.length}\n`);

  // 4. Cargar productos existentes del tenant
  const existingByCode = new Map(); // UPPER_CODE -> { id, codigo, nombre }
  const existingByName = new Map(); // lower_name -> { id, codigo, nombre }
  if (envConfig.serviceRoleKey) {
    console.log(`Consultando productos existentes...`);
    const { data, error } = await supabase.from("productos").select("id, codigo, nombre").eq("tenant_id", tenantId);
    if (error) {
      console.warn(`${c.yellow}Aviso: ${error.message}${c.reset}`);
    } else {
      for (const p of data ?? []) {
        if (p.codigo) existingByCode.set(p.codigo.trim().toUpperCase(), p);
        if (p.nombre) existingByName.set(p.nombre.trim().toLowerCase(), p);
      }
      console.log(`${c.green}✔ Productos en BD:${c.reset} ${existingByCode.size}\n`);
    }
  }

  // 5. Clasificar filas del Excel
  const toInsert = [];
  const toUpdate = [];
  const toSkip = [];
  const autoGeneratedCodes = [];
  const existingProductsToStock = []; // productos ya en BD que necesitan stock
  const allKnownCodes = new Set(existingByCode.keys());

  // Pre-cargar códigos del Excel para que generateProductCode los evite
  for (const r of rawRows) {
    if (r.rawCodigo) allKnownCodes.add(r.rawCodigo.toUpperCase());
  }

  for (const row of rawRows) {
    if (!row.nombre) {
      toSkip.push({ ...row, motivo: "Nombre vacío" });
      continue;
    }

    const codigoUpper = row.rawCodigo ? row.rawCodigo.trim().toUpperCase() : "";
    let codigo = codigoUpper;

    // Buscar si ya existe en la BD (por código o por nombre)
    let existingInDb = codigoUpper
      ? existingByCode.get(codigoUpper)
      : existingByName.get(row.nombre.trim().toLowerCase());

    if (existingInDb && !codigoUpper) {
      codigo = existingInDb.codigo; // usar el código que ya tiene en BD
    }

    // Si no tiene código, auto-generar (o skipear)
    if (!codigo && !existingInDb) {
      if (args.soloConCodigo) {
        toSkip.push({ ...row, motivo: "Sin código (--solo-con-codigo activado)" });
        continue;
      }
      codigo = generateProductCode(row.nombre, allKnownCodes);
      autoGeneratedCodes.push({ rowNumber: row.rowNumber, nombre: row.nombre, codigo });
    }

    const stockData = { rawCantidad: row.rawCantidad, rawStockMinimo: row.rawStockMinimo, rawStockMaximo: row.rawStockMaximo };

    if (existingInDb) {
      // Producto ya existe: no reinsertarlo, pero sí generar stock si falta
      existingProductsToStock.push({ ...existingInDb, ...stockData });

      if (args.actualizarExistentes) {
        const marca = args.inferirMarca ? inferMarca(row.nombre) : null;
        const categorias = args.inferirCategorias ? inferCategorias(row.nombre) : [];
        toUpdate.push({
          id: existingInDb.id, rowNumber: row.rowNumber,
          codigo, nombre: row.nombre, marca: marca || null,
          modelo: null, descripcion: null, precio_unitario: 0,
          costo_unitario: 0, proveedor: null, categorias, show_in_stock: true,
        });
      } else {
        toSkip.push({ ...row, codigo, motivo: `Ya existe: ${existingInDb.nombre} [${existingInDb.codigo}]` });
      }
    } else {
      const marca = args.inferirMarca ? inferMarca(row.nombre) : null;
      const categorias = args.inferirCategorias ? inferCategorias(row.nombre) : [];
      toInsert.push({
        id: crypto.randomUUID(), tenant_id: tenantId,
        codigo, nombre: row.nombre, marca: marca || null,
        modelo: null, descripcion: null, precio_unitario: 0,
        costo_unitario: 0, proveedor: null, categorias, show_in_stock: true,
        // Metadatos internos (se excluyen antes de enviar a Supabase)
        rowNumber: row.rowNumber, fueGenerado: !!autoGeneratedCodes.find((x) => x.codigo === codigo),
        ...stockData,
      });
    }
  }

  // 6. Calcular registros de stock a crear
  let talleres = [];
  const existingStockKeys = new Set();
  const stocksToCreate = [];

  if (args.inicializarStock && envConfig.serviceRoleKey) {
    // Cargar talleres
    let tQuery = supabase.from("talleres").select("id, nombre").eq("tenant_id", tenantId);
    if (args.tallerId) tQuery = tQuery.eq("id", args.tallerId);
    const { data: tData, error: tErr } = await tQuery;
    if (tErr) console.warn(`${c.yellow}Aviso talleres: ${tErr.message}${c.reset}`);
    else talleres = tData ?? [];

    // Cargar stocks existentes
    const { data: dbStocks, error: sErr } = await supabase
      .from("stocks")
      .select("producto_id, taller_id, cantidad, stock_minimo, stock_maximo")
      .eq("tenant_id", tenantId);

    if (sErr) {
      console.warn(`${c.yellow}Aviso stocks: ${sErr.message}${c.reset}`);
    } else {
      let negativos = 0;
      for (const s of dbStocks ?? []) {
        existingStockKeys.add(`${s.producto_id}:${s.taller_id}`);
        if ((s.cantidad ?? 0) < 0 || (s.stock_minimo ?? 0) < 0 || (s.stock_maximo ?? 0) < 0) {
          negativos++;
          if (args.verbose) console.warn(`${c.yellow}⚠ Stock negativo: producto_id=${s.producto_id}${c.reset}`);
        }
      }
      if (negativos > 0) {
        console.warn(`${c.yellow}⚠ ${negativos} stocks con valores negativos en BD (los nuevos se crearán en ≥ 0)${c.reset}`);
      }
      console.log(`${c.green}✔ Stocks existentes:${c.reset} ${existingStockKeys.size}`);
    }

    if (talleres.length > 0) {
      // Unir todos los productos existentes (BD completa + los detectados en el Excel)
      const productsForStock = new Map();
      for (const [, p] of existingByCode) productsForStock.set(p.id, p);
      for (const p of existingProductsToStock) {
        // Los del Excel tienen los valores de stock; priorizar su versión
        productsForStock.set(p.id, p);
      }

      const addStocksForProduct = (p, stockData) => {
        for (const t of talleres) {
          const key = `${p.id}:${t.id}`;
          if (existingStockKeys.has(key)) {
            if (args.verbose) console.log(`${c.dim}  ↷ Stock ya existe: ${p.codigo} / taller ${t.nombre}${c.reset}`);
            continue;
          }
          existingStockKeys.add(key);
          stocksToCreate.push(buildStockRecord(tenantId, t.id, p.id, stockData));
        }
      };

      // Productos ya existentes en BD (incluyendo los del Excel)
      for (const [, p] of productsForStock) {
        addStocksForProduct(p, p); // p ya tiene rawCantidad etc. si vino del Excel
      }

      // Productos nuevos (a insertar)
      for (const p of toInsert) {
        addStocksForProduct(p, p);
      }
    }
  }

  // 7. Resumen preliminar
  console.log(`\n${c.bold}=== Desglose ===${c.reset}`);
  console.log(`Filas leídas:          ${rawRows.length}`);
  console.log(`Nuevos a insertar:     ${c.green}${toInsert.length}${c.reset}`);
  console.log(`Códigos auto-generados:${c.cyan}${autoGeneratedCodes.length}${c.reset}`);
  console.log(`A actualizar:          ${c.yellow}${toUpdate.length}${c.reset}`);
  console.log(`Omitidos:              ${c.dim}${toSkip.length}${c.reset}`);
  if (talleres.length > 0) {
    console.log(`Talleres:              ${talleres.map((t) => t.nombre).join(", ")}`);
    console.log(`Stocks a crear:        ${c.cyan}${stocksToCreate.length}${c.reset}`);
  }
  console.log();

  if (autoGeneratedCodes.length > 0 && args.verbose) {
    console.log(`${c.bold}Códigos auto-generados (primeros 10):${c.reset}`);
    autoGeneratedCodes.slice(0, 10).forEach(({ rowNumber, codigo, nombre }) => {
      console.log(`  Fila ${String(rowNumber).padStart(3)}: ${c.cyan}${codigo}${c.reset} ← ${nombre}`);
    });
    if (autoGeneratedCodes.length > 10) console.log(`  ... y ${autoGeneratedCodes.length - 10} más.`);
    console.log();
  }

  // 8. Ejecutar o simular
  const resultados = { insertados: 0, actualizados: 0, omitidos: toSkip.length, stocksCreados: 0, errores: [] };

  if (args.dryRun) {
    console.log(`${c.yellow}Simulación completada. Ningún dato fue modificado.${c.reset}`);
  } else {
    // Insertar productos nuevos
    if (toInsert.length > 0) {
      console.log(`Insertando ${toInsert.length} productos...`);
      for (let i = 0; i < toInsert.length; i += args.batchSize) {
        const batch = toInsert.slice(i, i + args.batchSize);
        // Excluir campos internos antes de enviar a Supabase
        const payload = batch.map(({ rowNumber, fueGenerado, rawCantidad, rawStockMinimo, rawStockMaximo, ...item }) => item);

        const { error } = await supabase.from("productos").insert(payload);
        if (error) {
          console.warn(`${c.yellow}Falló lote. Reintentando uno por uno...${c.reset}`);
          for (const item of batch) {
            const { rowNumber, fueGenerado, rawCantidad, rawStockMinimo, rawStockMaximo, ...rowPayload } = item;
            const { error: singleError } = await supabase.from("productos").insert([rowPayload]);
            if (singleError) {
              resultados.errores.push({ fila: rowNumber, codigo: item.codigo, error: singleError.message });
              if (args.verbose) console.error(`  ${c.red}✖ Fila ${rowNumber} (${item.codigo}): ${singleError.message}${c.reset}`);
            } else { resultados.insertados++; }
          }
        } else {
          resultados.insertados += batch.length;
          process.stdout.write(`  ✔ ${resultados.insertados}/${toInsert.length}\r`);
        }
      }
      console.log(`\n${c.green}✔ Insertados:${c.reset} ${resultados.insertados}`);
    }

    // Actualizar existentes
    if (toUpdate.length > 0) {
      console.log(`Actualizando ${toUpdate.length} productos...`);
      for (const { id, rowNumber, ...payload } of toUpdate) {
        const { error } = await supabase.from("productos").update(payload).eq("id", id);
        if (error) resultados.errores.push({ fila: rowNumber, codigo: payload.codigo, error: error.message });
        else resultados.actualizados++;
      }
      console.log(`${c.green}✔ Actualizados:${c.reset} ${resultados.actualizados}`);
    }

    // Crear stocks
    if (stocksToCreate.length > 0) {
      console.log(`Creando ${stocksToCreate.length} registros de stock...`);
      for (let i = 0; i < stocksToCreate.length; i += args.batchSize) {
        const batch = stocksToCreate.slice(i, i + args.batchSize);
        const { error } = await supabase.from("stocks").insert(batch);
        if (error) {
          console.warn(`${c.yellow}Falló lote de stocks. Reintentando uno por uno...${c.reset}`);
          for (const item of batch) {
            const { error: singleError } = await supabase.from("stocks").insert([item]);
            if (singleError) resultados.errores.push({ tipo: "stock", producto_id: item.producto_id, error: singleError.message });
            else resultados.stocksCreados++;
          }
        } else {
          resultados.stocksCreados += batch.length;
          process.stdout.write(`  ✔ ${resultados.stocksCreados}/${stocksToCreate.length}\r`);
        }
      }
      console.log(`\n${c.green}✔ Stocks creados:${c.reset} ${resultados.stocksCreados}`);
    }
  }

  // 9. Reporte JSON (opcional o si hay errores)
  const reporte = {
    timestamp: new Date().toISOString(),
    tenant: { id: tenantId, nombre: tenantNombre },
    archivo: filePath,
    dryRun: args.dryRun,
    resumen: {
      totalFilas: rawRows.length,
      insertados: resultados.insertados,
      actualizados: resultados.actualizados,
      omitidos: toSkip.length,
      codigosAutoGenerados: autoGeneratedCodes.length,
      stocksCreados: args.dryRun ? stocksToCreate.length : resultados.stocksCreados,
      errores: resultados.errores.length,
    },
    autoGenerados: autoGeneratedCodes,
    omitidos: toSkip,
    errores: resultados.errores,
  };

  const reportPath = args.reportePath
    ? path.resolve(process.cwd(), args.reportePath)
    : path.resolve(process.cwd(), "scripts", `reporte_import_${Date.now()}.json`);

  if (args.reportePath || resultados.errores.length > 0 || args.dryRun) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(reporte, null, 2), "utf8");
    console.log(`\nReporte: ${c.bold}${reportPath}${c.reset}`);
  }

  // 10. Resumen final
  console.log(`\n${c.bold}=== Resumen Final ===${c.reset}`);
  console.log(`Estado:    ${resultados.errores.length === 0 ? c.green + "OK" : c.red + "CON ERRORES"}${c.reset}`);
  console.log(`Insertados:${c.green}${resultados.insertados}${c.reset} / ${toInsert.length}`);
  console.log(`Actualizados:${c.yellow}${resultados.actualizados}${c.reset}`);
  console.log(`Stocks:    ${c.cyan}${args.dryRun ? stocksToCreate.length + " (simulado)" : resultados.stocksCreados}${c.reset}`);
  console.log(`Omitidos:  ${toSkip.length}`);
  console.log(`Errores:   ${resultados.errores.length > 0 ? c.red + resultados.errores.length : "0"}${c.reset}\n`);

  return resultados.errores.length > 0 ? 1 : 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code || 0))
    .catch((err) => {
      console.error(`\n${c.red}Error no controlado:${c.reset}`, err);
      process.exit(1);
    });
}

module.exports = { inferMarca, inferCategorias, generateProductCode, readExcelFile, resolveEnvConfig };
