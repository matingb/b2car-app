import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
import { empresaService } from '../empresaService'
import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'
import { statsService } from '@/app/api/dashboard/stats/dashboardStatsService'

vi.mock('@/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('../empresaService', () => ({
  empresaService: {
    delete: vi.fn()
  }
}))

vi.mock('@/app/api/dashboard/stats/dashboardStatsService', () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}))

describe('DELETE /api/clientes/empresas/[id]', () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase)
  })

  it('al borrar una empresa, se debe borrar usando la transacción atómica', async () => {
    const testId = '456'
    const mockRequest = {} as NextRequest
    const mockParams = Promise.resolve({ id: testId })

    vi.mocked(empresaService.delete).mockResolvedValue({ error: null })

    const response = await DELETE(mockRequest, { params: mockParams })
    const body = await response.json()

    expect(empresaService.delete).toHaveBeenCalledWith(mockSupabase, testId)
    expect(response.status).toBe(200)
    expect(body).toEqual({ data: null })
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('debería retornar error 500 si falla la transacción de eliminación', async () => {
    const testId = '456'
    const mockRequest = {} as NextRequest
    const mockParams = Promise.resolve({ id: testId })
    const errorMessage = 'Error en la transacción de eliminación'

    vi.mocked(empresaService.delete).mockResolvedValue({ 
      error: new Error(errorMessage)
    })

    const response = await DELETE(mockRequest, { params: mockParams })
    const body = await response.json()

    expect(empresaService.delete).toHaveBeenCalledWith(mockSupabase, testId)
    expect(response.status).toBe(500)
    expect(body).toEqual({ error: errorMessage })
  })
})
