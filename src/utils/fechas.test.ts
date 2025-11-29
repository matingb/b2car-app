import { describe, it, expect } from 'vitest';
import { isValidDate } from './fechas';

describe('isValidDate', () => {
    it('debería retornar true para una fecha válida en formato YYYY-MM-DD', () => {
        expect(isValidDate('2025-11-29')).toBe(true);
    });
    
    it('debería retornar false para una cadena vacía', () => {
        expect(isValidDate('')).toBe(false);
    });

    it('debería retornar false para una fecha con día inválido', () => {
        expect(isValidDate('2025-02-30')).toBe(false);
    });

    it('debería retornar false para un formato incorrecto', () => {
        expect(isValidDate('29-11-2025')).toBe(false);
    });

    it('debería retornar false para texto que no es fecha', () => {
        expect(isValidDate('abc')).toBe(false);
    });
});

