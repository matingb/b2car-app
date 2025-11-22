import { describe, it, expect } from 'vitest';
import { formatPatente } from './vehiculos';

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

