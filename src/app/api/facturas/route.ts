import { NextResponse as Response } from "next/server";
import { AfipServices, IConfigService } from "facturajs";
import moment from 'moment';

const config = {
    certPath: './secret/cert.pem',
    privateKeyPath: './secret/private_key.key',
    // or use directly content keys if you need
    // certContents: fs.readFileSync('./private/dev/cert.pem').toString('utf8'),
    // privateKeyContents: fs.readFileSync('./private/dev/private_key.key').toString('utf8'),
    cacheTokensPath: './secret/.lastTokens',
    homo: true,
    tokensExpireInHours: 12,
}

const afip = new AfipServices(config);
const cuit = 20442094161;

async function facturaBExample() {
    const res = await afip.getLastBillNumber({
        Auth: { 
            Cuit: cuit,
            Denominacion_Representado: "Agustín Bustos Piasentini",
            Condicion_IVA: "Responsable Inscripto",
        },
        params: {
            CbteTipo: 6,
            PtoVta: 1,
        },
    });
    console.log('Last bill number: ', res.CbteNro);
    const num = res.CbteNro;
    const next = num + 1;
    console.log('Next bill number to create: ', next);
    const resBill = await afip.createBill({
        Auth: { Cuit: cuit },
        params: {
            FeCAEReq: {
                FeCabReq: {
                    CantReg: 1,
                    PtoVta: 1,
                    // Factura B
                    CbteTipo: 6,
                },
                FeDetReq: {
                    FECAEDetRequest: {
                        DocTipo: 99,
                        DocNro: 0,
                        Concepto: 1,
                        CbteDesde: next,
                        CbteHasta: next,
                        CbteFch: moment().format('YYYYMMDD'),
                        ImpTotal: 121.0,
                        ImpTotConc: 0,
                        ImpNeto: 100,
                        ImpOpEx: 0,
                        ImpIVA: 21,
                        ImpTrib: 0,
                        MonId: 'PES',
                        MonCotiz: 1,
                        Items: [
                            {
                                "Descripcion": "Producto 1",
                                "Cantidad": 1,
                                "PrecioUnitario": 100,
                                "Bonificacion": 0,
                                "AlicuotaIVA": 21,
                                "IVA": 21,
                                "Importe": 121
                            }
                        ],
                        CondicionIVAReceptorId: 5,
                        Iva: [
                            {
                                AlicIva: {
                                    Id: 5, // Id del tipo de IVA (5 es 21%)
                                    BaseImp: 100, // Base imponible
                                    Importe: 21, // Importe
                                },
                            },
                        ],
                    },
                },
            },
        },
    });
    console.log('Created bill', JSON.stringify(resBill, null, 4));
    return resBill;
}

export async function POST(req: Request) {
    try {
        const resBill = await facturaBExample();
        return Response.json(resBill);
    }
    catch (error) {
        console.error('Error creating bill:', error);
        return Response.json({ error: 'Error al crear la factura' }, { status: 500 });
    }
}
