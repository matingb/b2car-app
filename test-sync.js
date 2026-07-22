const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: arreglos } = await supabase.from('arreglos').select('id, tipo, tipos').limit(1);
  console.log("Arreglos:", arreglos);

  if (arreglos && arreglos.length > 0) {
    const arregloId = arreglos[0].id;
    console.log("Fetching details for:", arregloId);
    const { data: rpcData, error } = await supabase.rpc("rpc_get_arreglo_detalle", { p_arreglo_id: arregloId });
    if (error) console.error("RPC Error:", error);

    const detalles = Array.isArray(rpcData.detalles) ? rpcData.detalles : [];
    const asignaciones = Array.isArray(rpcData.asignaciones) ? rpcData.asignaciones : [];

    console.log("Detalles count:", detalles.length);
    console.log("Asignaciones count:", asignaciones.length);

    const tipoIds = new Set();
    detalles.forEach(d => {
      console.log("Detalle tipo_arreglo_id:", d.tipo_arreglo_id);
      if (d.tipo_arreglo_id) tipoIds.add(d.tipo_arreglo_id);
    });
    asignaciones.forEach(a => {
      if (Array.isArray(a.lineas)) {
        a.lineas.forEach(l => {
          console.log("Linea tipo_arreglo_id:", l.tipo_arreglo_id);
          if (l.tipo_arreglo_id) tipoIds.add(l.tipo_arreglo_id);
        });
      }
    });

    console.log("Tipo IDs collected:", Array.from(tipoIds));

    if (tipoIds.size > 0) {
      const { data: tiposRows } = await supabase
        .from("tipos_arreglo")
        .select("id, nombre")
        .in("id", Array.from(tipoIds));
      console.log("Tipos rows:", tiposRows);
    }
  }
}

run();
