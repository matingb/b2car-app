import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
import { particularService } from '../particularService'
import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'
import { statsService } from '@/app/api/dashboard/stats/dashboardStatsService'

vi.mock('@/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('../particularService', () => ({
  particularService: {
    delete: vi.fn()
  }
}))

vi.mock('@/app/api/dashboard/stats/dashboardStatsService', () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}))

describe('DELETE /api/clientes/particulares/[id]', () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase)
  })

  it('dado que se borra un particular, cuando no hay error, debería devolver un status 200 y un body vacío', async () => {
    const testId = '123'
    const mockRequest = {} as NextRequest
    const mockParams = Promise.resolve({ id: testId })

    vi.mocked(particularService.delete).mockResolvedValue({ error: null })

    const response = await DELETE(mockRequest, { params: mockParams })
    const body = await response.json()

    expect(particularService.delete).toHaveBeenCalledWith(mockSupabase, testId)
    expect(response.status).toBe(200)
    expect(body).toEqual({ data: null })
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1)
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase)
  })

  it('dado que se borra un particular, cuando hay error, debería devolver un status 500 y un body con el error', async () => {
    const testId = '123'
    const mockRequest = {} as NextRequest
    const mockParams = Promise.resolve({ id: testId })
    const errorMessage = 'Error en la transacción de eliminación'

    vi.mocked(particularService.delete).mockResolvedValue({ 
      error: new Error(errorMessage)
    })

    const response = await DELETE(mockRequest, { params: mockParams })
    const body = await response.json()

    expect(particularService.delete).toHaveBeenCalledWith(mockSupabase, testId)
    expect(response.status).toBe(500)
    expect(body).toEqual({ error: errorMessage })
  })
})

