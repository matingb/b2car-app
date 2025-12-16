import { describe, it, expect, vi } from 'vitest';
import { clientesClient } from './clientesClient';
import { createCliente } from '@/testing/factories';

const mockApi = vi.fn();
global.fetch = mockApi;

describe('clientesClient', () => {

    describe('getAll', () => {
        it('debería retornar una lista de clientes cuando la respuesta es exitosa', async () => {
            const clientes = [
                createCliente({ id: 1, nombre: 'Juan Pérez' }),
                createCliente({ id: 2, nombre: 'Empresa XYZ' }),
            ];

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: clientes,
                    error: null,
                }),
            });

            const result = await clientesClient.getAll();

            expect(mockApi).toHaveBeenCalledWith('/api/clientes');
            expect(result).toEqual({
                data: clientes,
                error: null,
            });
        });

        it('debería retornar array vacío cuando no hay datos', async () => {
            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: null,
                }),
            });

            const result = await clientesClient.getAll();

            expect(result).toEqual({
                data: [],
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun cliente', async () => {
            const mensajeError = 'Connection timeout';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await clientesClient.getAll();

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });
});
