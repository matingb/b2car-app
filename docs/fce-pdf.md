# Representación PDF de FCE MiPyME

Revisión normativa: 09/10/2026. El generador compartido sigue siendo
`src/lib/facturacion/fiscalPdf.ts`; no se modifica la autorización ante ARCA,
los importes autorizados ni los snapshots almacenados.

## Normativa revisada

- [Ley 27.440, art. 5](https://www.argentina.gob.ar/normativa/nacional/ley-27440-310084/texto):
  exige importe numérico y en letras, referencias a remitos si existen y la
  información sobre aceptación, efectos ejecutivos y transferencia de información.
- [Resolución 219/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/333509/20251028):
  mantiene 21 días corridos entre 01/11/2025 y 31/10/2026. Sus considerandos
  identifican las prórrogas anteriores. No se encontró una disposición posterior
  que cambie este plazo para el ejemplo del 09/10/2026.
- [RG 4367/2018, texto actualizado, art. 7](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-4367-2018-317926/actualizacion):
  remite a los requisitos de la ley y del Anexo II de la RG 1415.
- [RG 1415/2003, texto actualizado, Anexo II](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1415-2003-81316/actualizacion):
  identificación fiscal, IIBB, domicilio comercial y condición IVA. El apartado
  A.IV.b impide discriminar IVA para emisores monotributistas. A/B conservan su
  presentación y sus importes existentes.
- [RG 4291/2018, texto actualizado, arts. 14 y 15](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-4291-2018-313088/actualizacion):
  representación gráfica y CAE; art. 14 exceptúa las etiquetas del Anexo II.A.I.c
  (ORIGINAL/DUPLICADO). Se revisaron también los cambios posteriores incorporados
  en los textos actualizados: RG 5614/2024 (transparencia fiscal), RG 5764/2025
  (regímenes específicos de clase A) y RG 5866/2026 (datos adicionales). Ninguno
  elimina los requisitos de letras y leyenda de la FCE C. Este cambio no constituye
  una implementación nueva de esos regímenes ni una auditoría integral de A/B.
- [Especificación oficial QR ARCA](https://www.arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf):
  se conserva el enlace oficial con JSON en Base64, versión 1, tipos numéricos,
  moneda PES, cotización 1 y autorización E/CAE.

## Plazos y actualización

`fiscalPresentation.ts` centraliza los regímenes por fecha de emisión desde
01/04/2023. Los límites son inclusivos y las prórrogas terminan en 31/10/2026.
A partir de 01/11/2026 se utiliza el plazo legal base de 15 días, conforme a la
normativa verificada en esta revisión; si se publica una nueva prórroga, debe
agregarse al registro y aumentarse la versión de caché del PDF. Las fechas
anteriores al registro requieren revisar su normativa histórica y producen
un error explícito, en lugar de aplicar retroactivamente el plazo actual.

El plazo se cuenta desde la recepción en el domicilio fiscal electrónico. La
aplicación no almacena esa fecha, por lo que la leyenda explica el origen del
plazo sin inventar un vencimiento de aceptación a partir de la fecha de emisión.

## Datos fiscales y límites del modelo actual

- IIBB usa `ingresosBrutos` del snapshot. Puede contener inscripción local,
  Convenio Multilateral, exención o condición de no contribuyente. Si falta en una
  FCE, el servicio consulta la configuración del mismo tenant, ambiente y CUIT
  exclusivamente para completar ese campo del PDF; no actualiza el snapshot.
  Si tampoco está allí, la descarga falla con una indicación de qué completar.
- `domicilio` es un único campo de texto en la configuración fiscal. Debe cargarse
  con calle, altura, localidad y provincia. El PDF lo imprime completo y admite
  también `localidad` y `provincia` explícitas en su entrada, sin duplicarlas.
  Esta rama no tiene esos campos separados en configuración ni en talleres.
  Un snapshot histórico que sólo contiene calle y altura seguirá incompleto:
  no se infiere geografía ni se sustituye su domicilio por el domicilio actual.
- Las denominaciones IVA se normalizan sólo al presentar el comprobante;
  los enums y los datos persistidos no cambian.
- Esta rama no incluye el módulo, las tablas ni las relaciones de remitos.
  Conforme al alcance solicitado, no se incorporan. La entrada opcional
  `remitosAsociados` permite imprimir y paginar múltiples referencias reales
  R/X, con punto de emisión y número, cuando el servicio cuente con esa relación.
  Actualmente `buildFacturaPdf` no puede obtenerlas de una fuente inexistente.
  No se crean vínculos ni se muestra una sección vacía.

## Caché y verificación

El seguimiento manual de aceptación/rechazo/pago quedó fuera del alcance. Se
retiraron el selector de estado, su indicador en el listado y el endpoint de
actualización. Los campos históricos de base de datos se conservan por
compatibilidad con sus restricciones de autorización; no se exponen como estado
de la FCE ni se ofrecen acciones para editarlos en la aplicación.

La versión pasa de `fiscal-v4` a `fiscal-v6`: la siguiente descarga regenera
el documento con la nueva representación sin reemitirlo ni cambiar CAE/QR.
Las letras usan la conversión fiscal existente a centavos y rechazan valores
con más de dos decimales en lugar de redondear un importe autorizado distinto.
En clase C se muestran subtotal, otros tributos y total; se omite la fila IVA.

Las pruebas cubren centavos, apócope, límites monetarios, selección de régimen,
leyenda exclusiva FCE, IIBB/configuración por tenant y ambiente, referencias,
conservación de CAE/QR, A/B, paginación y caducidad de la caché anterior.
La muestra `output/pdf/fce-c-ejemplo.pdf` se generó con el código real y datos
ficticios señalados como tales. Se renderizaron y revisaron todas las páginas
de esa muestra y de los casos A/B, múltiples remitos y descripción extensa.
