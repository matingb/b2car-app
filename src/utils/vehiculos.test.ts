import { describe, it, expect } from 'vitest';
import { formatPatente, formatPatenteConMarcaYModelo } from './vehiculos';

describe('formatPatente', () => {
    it('dada una patente de 7 caracteres, deberia formatearla correctamente', () => {
        expect(formatPatente('AB123CD')).toBe('AB 123 CD');
    });

    it('dada una patente de 6 caracteres, deberia formatearla correctamente', () => {
        expect(formatPatente('ABC123')).toBe('ABC 123');
    });

    it('debería devolver la patente tal cual si no tiene 6 o 7 caracteres', () => {
        expect(formatPatente('AB12')).toBe('AB12');
        expect(formatPatente('ABCDEFGH')).toBe('ABCDEFGH');
    });
});

describe('formatPatenteConMarcaYModelo', () => {
    type Arg = Parameters<typeof formatPatenteConMarcaYModelo>[0];
    const makeVehiculo = (overrides: Partial<Arg> = {}): Arg => ({
        patente: 'AA111BB',
        marca: '',
        modelo: '',
        ...overrides,
    });

    it("cuando marca y modelo están presentes, devuelve 'patente - marca modelo'", () => {
        const vehiculo = makeVehiculo({ marca: 'Ford', modelo: 'Fiesta' });

        const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

        expect(patenteFormateada).toBe('AA111BB - Ford Fiesta');
    });

    it('cuando marca y modelo están ausentes, devuelve solo la patente (sin guion)', () => {
        const vehiculo = makeVehiculo();

        const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

        expect(patenteFormateada).toBe('AA111BB');
    });

    it('cuando falta marca o modelo, evita espacios extras y mantiene el guion solo si corresponde', () => {
        const vehiculoSoloMarca = makeVehiculo({ marca: 'Ford' });
        const vehiculoSoloModelo = makeVehiculo({ modelo: 'Fiesta' });

        const patenteConMarca = formatPatenteConMarcaYModelo(vehiculoSoloMarca);
        const patenteConModelo = formatPatenteConMarcaYModelo(vehiculoSoloModelo);

        expect(patenteConMarca).toBe('AA111BB - Ford');
        expect(patenteConModelo).toBe('AA111BB - Fiesta');
    });

    it('hace trim de los campos para evitar espacios sobrantes', () => {
        const vehiculo = makeVehiculo({ patente: '  AA111BB  ', marca: '  Ford ', modelo: ' Fiesta  ' });

        const patenteFormateada = formatPatenteConMarcaYModelo(vehiculo);

        expect(patenteFormateada).toBe('AA111BB - Ford Fiesta');
    });
});

