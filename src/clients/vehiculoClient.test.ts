import { describe, it, expect, vi } from 'vitest';
import { vehiculoClient } from './vehiculoClient';
import { createVehiculo, createCliente, createArreglo } from '@/tests/factories';

const mockApi = vi.fn();
global.fetch = mockApi;

describe('vehiculoClient', () => {

    describe('getById', () => {
        it('debería retornar un vehículo con sus arreglos cuando la respuesta es exitosa', async () => {
            const vehiculo = createVehiculo({ id: 1 });
            const arreglos = [createArreglo({ vehiculo: vehiculo })];

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: vehiculo,
                    arreglos: arreglos,
                }),
            });

            const result = await vehiculoClient.getById(vehiculo.id);

            expect(mockApi).toHaveBeenCalledWith('/api/vehiculos/1');
            expect(result).toEqual({
                data: vehiculo,
                arreglos: arreglos,
                error: null,
            });
        });

        it('debería retornar un vehículo sin arreglos cuando no hay arreglos', async () => {
            const vehiculo = createVehiculo();

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: vehiculo,
                }),
            });

            const result = await vehiculoClient.getById(vehiculo.id);

            expect(result).toEqual({
                data: vehiculo,
                arreglos: [],
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun vehiculo', async () => {
            const mensajeError = 'Network error';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await vehiculoClient.getById(1);
            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });

    describe('getAll', () => {
        it('debería retornar una lista de vehículos cuando la respuesta es exitosa', async () => {
            const vehiculos = [
                createVehiculo({ id: 1, patente: 'ABC123' }),
                createVehiculo({ id: 2, patente: 'XYZ789' }),
            ];

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: vehiculos,
                    error: null,
                }),
            });

            const result = await vehiculoClient.getAll();

            expect(mockApi).toHaveBeenCalledWith('/api/vehiculos');
            expect(result).toEqual({
                data: vehiculos,
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

            const result = await vehiculoClient.getAll();

            expect(result).toEqual({
                data: [],
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun vehiculo', async () => {
            const mensajeError = 'Connection timeout';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await vehiculoClient.getAll();

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });

    describe('getClienteForVehiculo', () => {
        it('debería retornar el cliente propietario cuando la respuesta es exitosa', async () => {
            const cliente = createCliente({ id: 1 });
            const vehiculoId = 1;

            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: cliente,
                    error: null,
                }),
            });

            const result = await vehiculoClient.getClienteForVehiculo(vehiculoId);

            expect(mockApi).toHaveBeenCalledWith(`/api/vehiculos/${vehiculoId}/cliente`);
            expect(result).toEqual({
                data: cliente,
                error: null,
            });
        });

        it('debería retornar null cuando no hay cliente asociado', async () => {
            mockApi.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: null,
                }),
            });

            const result = await vehiculoClient.getClienteForVehiculo(1);

            expect(result).toEqual({
                data: null,
                error: null,
            });
        });

        it('dado un error, deberia devolver un mensaje de error y ningun cliente', async () => {
            const mensajeError = 'Failed to fetch';
            mockApi.mockRejectedValueOnce(new Error(mensajeError));

            const result = await vehiculoClient.getClienteForVehiculo(1);

            expect(result).toEqual({
                data: null,
                error: mensajeError,
            });
        });
    });
});

