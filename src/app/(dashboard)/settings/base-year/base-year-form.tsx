'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, Save, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { GHGInventory, Organization } from '@/types/database'

interface Props {
  organization: Organization
  inventories: Pick<GHGInventory, 'id' | 'fiscal_year' | 'status' | 'ef_source'>[]
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  verified: 'Verificado',
}

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  draft: 'default',
  submitted: 'warning',
  verified: 'success',
}

export function BaseYearForm({ organization, inventories }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const [baseYear, setBaseYear] = useState<string>(
    organization.base_year != null ? String(organization.base_year) : ''
  )
  const [thresholdPct, setThresholdPct] = useState<string>(
    String(organization.recalc_threshold_pct ?? 5)
  )
  const [reason, setReason] = useState('')

  const isLocked = organization.base_year_locked_at != null

  const baseYearN = baseYear ? Number(baseYear) : null
  const thresholdN = Number(thresholdPct)
  const baseYearChanged = baseYearN !== organization.base_year
  const thresholdChanged = thresholdN !== Number(organization.recalc_threshold_pct)
  const canSave =
    !loading &&
    !isLocked &&
    (baseYearChanged || thresholdChanged) &&
    (baseYearN == null || (Number.isInteger(baseYearN) && baseYearN >= 1990 && baseYearN <= 2100)) &&
    Number.isFinite(thresholdN) &&
    thresholdN >= 0 &&
    thresholdN <= 100

  async function handleSave() {
    setLoading(true)
    setFeedback(null)

    const updates: Record<string, unknown> = {}
    if (thresholdChanged) updates.recalc_threshold_pct = thresholdN
    if (baseYearChanged) updates.base_year = baseYearN

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organization.id)
      if (error) {
        setFeedback({ ok: false, msg: `Error al guardar: ${error.message}` })
        setLoading(false)
        return
      }
    }

    // Si cambiamos el base year, marcamos la fila previa activa como
    // superseded y creamos la nueva en el historial.
    if (baseYearChanged && baseYearN != null) {
      const { error: supErr } = await supabase
        .from('base_year_metadata')
        .update({ superseded_at: new Date().toISOString() })
        .eq('organization_id', organization.id)
        .is('superseded_at', null)
      if (supErr) {
        setFeedback({ ok: false, msg: `Error marcando previa como superseded: ${supErr.message}` })
        setLoading(false)
        return
      }
      const { error: insErr } = await supabase.from('base_year_metadata').insert({
        organization_id: organization.id,
        base_year: baseYearN,
        reason: reason.trim() || null,
      })
      if (insErr) {
        setFeedback({ ok: false, msg: `Error al guardar historial: ${insErr.message}` })
        setLoading(false)
        return
      }
    }

    setFeedback({ ok: true, msg: 'Cambios guardados.' })
    setReason('')
    setLoading(false)
    router.refresh()
  }

  async function handleToggleLock() {
    setLoading(true)
    setFeedback(null)
    const newLockState = isLocked ? null : new Date().toISOString()
    const { error } = await supabase
      .from('organizations')
      .update({ base_year_locked_at: newLockState })
      .eq('id', organization.id)
    setLoading(false)
    if (error) {
      setFeedback({ ok: false, msg: `Error: ${error.message}` })
      return
    }
    setFeedback({ ok: true, msg: isLocked ? 'Base year desbloqueado.' : 'Base year bloqueado.' })
    router.refresh()
  }

  const sortedInventories = [...inventories].sort((a, b) => b.fiscal_year - a.fiscal_year)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white">Configuración</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Estado actual:{' '}
            {organization.base_year ? (
              <>
                Año base <span className="font-mono text-zinc-300">{organization.base_year}</span>
                {' · threshold '}{Number(organization.recalc_threshold_pct).toFixed(1)}%
                {' · '}
                {isLocked ? <Badge variant="info">Locked</Badge> : <Badge variant="default">Sin lock</Badge>}
              </>
            ) : (
              <span className="text-amber-300">Sin configurar</span>
            )}
          </p>
        </div>
        <button
          onClick={handleToggleLock}
          disabled={loading || organization.base_year == null}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isLocked
              ? 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10'
              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
          title={
            organization.base_year == null
              ? 'Primero fija un año base'
              : isLocked
                ? 'Desbloquear (sólo admin)'
                : 'Bloquear (recomendado tras designación)'
          }
        >
          {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {isLocked ? 'Desbloquear' : 'Bloquear'}
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="block text-[11px] text-zinc-400 mb-1.5">Año base</label>
          <select
            value={baseYear}
            onChange={(e) => setBaseYear(e.target.value)}
            disabled={isLocked || loading}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">— Sin asignar —</option>
            {sortedInventories.map((inv) => (
              <option key={inv.id} value={inv.fiscal_year}>
                {inv.fiscal_year} · {statusLabel[inv.status]} · FE: {inv.ef_source}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Recomendación GHG Protocol: usa un año <strong>verified</strong>, lo más antiguo posible que
            tenga cobertura completa de scopes.
          </p>
          {sortedInventories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sortedInventories.map((inv) => (
                <Badge key={inv.id} variant={statusVariant[inv.status]}>
                  {inv.fiscal_year} {statusLabel[inv.status]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] text-zinc-400 mb-1.5">
            Threshold de recálculo (%) ·{' '}
            <span className="text-zinc-500">excedido → propone recalcular</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(e.target.value)}
              disabled={isLocked || loading}
              className="flex-1 disabled:opacity-50"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(e.target.value)}
              disabled={isLocked || loading}
              className="w-20 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-sm text-white text-right disabled:opacity-50"
            />
            <span className="text-sm text-zinc-400">%</span>
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Default GHG Protocol: 5%. Más estricto (1–3%) si tienes alta exposición regulatoria; más laxo (10%) en sectores con alta variabilidad estacional.
          </p>
        </div>

        {baseYearChanged && (
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1.5">
              Razón del cambio <span className="text-zinc-500">(va al historial)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="ej. Designación inicial · Adquisición de Subsidiaria X · Corrección de error en S3"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}

        {feedback && (
          <p
            className={`text-[11px] rounded px-2 py-1.5 border ${
              feedback.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.msg}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
