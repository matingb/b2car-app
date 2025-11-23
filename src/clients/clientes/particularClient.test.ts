import { describe, it, expect, vi } from 'vitest';
import { particularClient } from './particularClient';
import { createMockParticular, createMockCliente } from '@/testing/factories';
import { TipoCliente } from '@/model/types';

const mockApi = vi.fn();
global.fetch = mockApi;

describe('particularClient', () => {

    describe('getById', () => {
        it('debería retornar un particular cuando la respuesta es exitosa', async () => {
            const particular = createMockParticular({ id: 1 });

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: particular,
                    error: null,
                }),
            });

            const result = await particularClient.getById(particular.id);

            expect(mockApi).toHaveBeenCalledWith(`/api/clientes/particulares/${particular.id}`);
            expect(result).toEqual({
                data: particular,
                error: null,
            });
        });

        it('debería retornar null cuando no hay particular asociado', async () => {
            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: null,
                }),
            });

            const result = await particularClient.getById(1);

            expect(result).toEqual({
                data: null,
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun particular', async () => {
            const mensajeError = 'Not found';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await particularClient.getById(999);

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });

    describe('create', () => {
        it('debería devolver el particular creado cuando la respuesta es exitosa', async () => {
            const input = {
                nombre: 'María',
                apellido: 'García',
                telefono: '0987654321',
                email: 'maria@example.com',
                direccion: 'Calle Nueva 789',
            };
            const particularResponse = {
                id: 2,
                nombre: 'María',
                apellido: 'García',
                telefono: '0987654321',
                email: 'maria@example.com',
                direccion: 'Calle Nueva 789',
            };
            const clienteEsperado = createMockCliente({
                id: 2,
                nombre: 'María García',
                tipo_cliente: TipoCliente.PARTICULAR,
                telefono: '0987654321',
                email: 'maria@example.com',
                direccion: 'Calle Nueva 789',
            });

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: particularResponse,
                }),
            });

            const result = await particularClient.create(input);

            expect(mockApi).toHaveBeenCalledWith(
                '/api/clientes/particulares',
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

        it('debería retornar null cuando no se puede crear el particular', async () => {
            const input = {
                nombre: 'Pedro',
                telefono: '1111111111',
                email: 'pedro@example.com',
                direccion: 'Calle Sin Salida 100',
            };

            mockApi.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    data: null,
                    error: 'Datos inválidos',
                }),
            });

            const result = await particularClient.create(input);

            expect(result).toEqual({
                data: null,
                error: 'Datos inválidos',
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun particular', async () => {
            const input = {
                nombre: 'Carlos',
                telefono: '2222222222',
                email: 'carlos@example.com',
                direccion: 'Av. Error 500',
            };
            const mensajeError = 'Network error';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await particularClient.create(input);

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });
});

