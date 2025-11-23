import { describe, it, expect, vi } from 'vitest';
import { empresaClient } from './empresaClient';
import { createMockEmpresa, createMockCliente } from '@/testing/factories';
import { TipoCliente } from '@/model/types';

const mockApi = vi.fn();
global.fetch = mockApi;

describe('empresaClient', () => {

    describe('getById', () => {
        it('debería retornar una empresa cuando la respuesta es exitosa', async () => {
            const empresa = createMockEmpresa({ id: 1 });

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: empresa,
                    error: null,
                }),
            });

            const result = await empresaClient.getById(empresa.id);

            expect(mockApi).toHaveBeenCalledWith(`/api/clientes/empresas/${empresa.id}`);
            expect(result).toEqual({
                data: empresa,
                error: null,
            });
        });

        it('debería retornar null cuando no hay empresa asociada', async () => {
            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: null,
                }),
            });

            const result = await empresaClient.getById(1);

            expect(result).toEqual({
                data: null,
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ninguna empresa', async () => {
            const mensajeError = 'Not found';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await empresaClient.getById(999);

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });

    describe('create', () => {
        it('debería devolver la empresa creada cuando la respuesta es exitosa', async () => {
            const input = {
                nombre: 'Tech Solutions S.A.',
                cuit: '30-98765432-1',
                telefono: '0987654321',
                email: 'info@techsolutions.com',
                direccion: 'Torre Empresarial 100',
            };
            const empresaResponse = {
                id: 2,
                nombre: 'Tech Solutions S.A.',
                cuit: '30-98765432-1',
                telefono: '0987654321',
                email: 'info@techsolutions.com',
                direccion: 'Torre Empresarial 100',
            };
            const clienteEsperado = createMockCliente({
                id: 2,
                nombre: 'Tech Solutions S.A.',
                tipo_cliente: TipoCliente.EMPRESA,
                telefono: '0987654321',
                email: 'info@techsolutions.com',
                direccion: 'Torre Empresarial 100',
                cuit: '30-98765432-1',
            });

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: empresaResponse,
                }),
            });

            const result = await empresaClient.create(input);

            expect(mockApi).toHaveBeenCalledWith(
                '/api/clientes/empresas',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input),
                })
            );
            expect(result).toEqual({
                data: clienteEsperado,
                error: null,
            });
        });

        it('debería retornar null y un error cuando no se puede crear la empresa', async () => {
            const input = {
                nombre: 'Comercial ABC',
                cuit: '20-11111111-1',
                telefono: '1111111111',
                email: 'abc@comercial.com',
                direccion: 'Local 50',
            };

            mockApi.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    data: null,
                    error: 'CUIT inválido',
                }),
            });

            const result = await empresaClient.create(input);

            expect(result).toEqual({
                data: null,
                error: 'CUIT inválido',
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ninguna empresa', async () => {
            const input = {
                nombre: 'Industrias SA',
                cuit: '33-22222222-3',
                telefono: '2222222222',
                email: 'contacto@industrias.com',
                direccion: 'Parque Industrial',
            };
            const mensajeError = 'Network error';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await empresaClient.create(input);

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });
});
