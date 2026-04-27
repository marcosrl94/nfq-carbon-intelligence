'use client'

import { useState, useTransition } from 'react'
import { Plus, Check, AlertTriangle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { proposeRecalculation, applyRecalculation } from '@/lib/base-year/actions'
import type { BaseYearRecalculation, BaseYearSnapshot, StructuralChangeType } from '@/types/database'

interface Props {
  recalculations: BaseYearRecalculation[]
  hasBaseYear: boolean
  thresholdPct: number
}

const typeLabel: Record<StructuralChangeType, string> = {
  acquisition: 'Adquisición',
  divestment: 'Desinversión',
  methodology_change: 'Cambio de metodología',
  ef_update: 'Actualización de FE',
  error_correction: 'Corrección de error',
  other: 'Otro',
}

const typeBadge: Record<StructuralChangeType, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  acquisition: 'info',
  divestment: 'warning',
  methodology_change: 'info',
  ef_update: 'default',
  error_correction: 'danger',
  other: 'default',
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 1 })
}

function SnapshotDiff({ pre, post }: { pre: BaseYearSnapshot; post: BaseYearSnapshot }) {
  const rows: Array<[string, number, number]> = [
    ['Alcance 1', pre.s1, post.s1],
    ['Alcance 2 (location)', pre.s2_location, post.s2_location],
    ['Alcance 2 (market)', pre.s2_market, post.s2_market],
    ['Alcance 3', pre.s3, post.s3],
    ['Total location-based', pre.total_location, post.total_location],
  ]
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
            <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500">Componente</th>
            <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500">Pre</th>
            <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500">Post</th>
            <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/30">
          {rows.map(([label, p, q]) => {
            const delta = q - p
            const isLast = label.startsWith('Total')
            return (
              <tr key={label} className={isLast ? 'bg-zinc-900/30 font-medium' : ''}>
                <td className="px-3 py-1.5 text-zinc-300">{label}</td>
                <td className="px-3 py-1.5 text-right text-zinc-400 tabular-nums">{fmt(p)}</td>
                <td className="px-3 py-1.5 text-right text-zinc-200 tabular-nums">{fmt(q)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${
                  delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RecalculationsSection({ recalculations, hasBaseYear, thresholdPct }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<StructuralChangeType>('other')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setFeedback({ ok: false, msg: 'La razón es obligatoria.' })
      return
    }
    setFeedback(null)
    startTransition(async () => {
      const result = await proposeRecalculation({ structural_change_type: type, reason })
      if (result.ok) {
        setFeedback({ ok: true, msg: 'Propuesta registrada. Revísala en la lista.' })
        setReason('')
        setOpen(false)
      } else {
        setFeedback({ ok: false, msg: result.error ?? 'Error desconocido.' })
      }
    })
  }

  function handleApply(id: string) {
    if (!confirm('¿Aplicar este recálculo? La fila quedará inmutable.')) return
    startTransition(async () => {
      const result = await applyRecalculation(id)
      if (!result.ok) setFeedback({ ok: false, msg: result.error ?? 'Error al aplicar.' })
    })
  }

  const pendingRecalcs = recalculations.filter((r) => !r.applied)
  const appliedRecalcs = recalculations.filter((r) => r.applied)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white">Recálculos del año base</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            GHG Protocol §5.4 · Threshold actual {thresholdPct.toFixed(1)}%
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={!hasBaseYear || pending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={!hasBaseYear ? 'Primero designa un año base' : 'Registrar nuevo recálculo'}
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar recálculo
        </button>
      </div>

      {feedback && (
        <p
          className={`mx-6 mt-4 text-[11px] rounded px-2 py-1.5 border ${
            feedback.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      {open && hasBaseYear && (
        <form onSubmit={handleSubmit} className="border-b border-zinc-800 p-6 space-y-3">
          <p className="text-[11px] text-zinc-400">
            Pre y post snapshots se calculan automáticamente: <strong>pre</strong> = último recálculo aplicado
            (o el snapshot actual si es el primero), <strong>post</strong> = estado actual del inventario
            del año base.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Tipo de cambio</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as StructuralChangeType)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {(Object.keys(typeLabel) as StructuralChangeType[]).map((t) => (
                  <option key={t} value={t}>{typeLabel[t]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] text-zinc-400 mb-1">Razón</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Adquisición de Subsidiaria X (2025-Q3) — añade plantas en Brasil"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setFeedback(null) }}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || !reason.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Calcular y registrar
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-zinc-800/50">
        {recalculations.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-zinc-500">
            Sin recálculos registrados.
          </p>
        ) : (
          <>
            {pendingRecalcs.length > 0 && (
              <div>
                <p className="px-6 py-2 text-[10px] uppercase tracking-wider text-amber-400 bg-amber-500/5">
                  Pendientes ({pendingRecalcs.length})
                </p>
                {pendingRecalcs.map((r) => (
                  <RecalcRow
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                    onApply={() => handleApply(r.id)}
                    pending={pending}
                  />
                ))}
              </div>
            )}
            {appliedRecalcs.length > 0 && (
              <div>
                <p className="px-6 py-2 text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-900/30">
                  Aplicados ({appliedRecalcs.length})
                </p>
                {appliedRecalcs.map((r) => (
                  <RecalcRow
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                    onApply={null}
                    pending={false}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RecalcRow({
  r,
  expanded,
  onToggle,
  onApply,
  pending,
}: {
  r: BaseYearRecalculation
  expanded: boolean
  onToggle: () => void
  onApply: (() => void) | null
  pending: boolean
}) {
  return (
    <div className="px-6 py-3.5">
      <button
        onClick={onToggle}
        className="flex items-start justify-between gap-3 w-full text-left"
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={typeBadge[r.structural_change_type]}>
                {typeLabel[r.structural_change_type]}
              </Badge>
              <span className="text-xs text-zinc-300">
                Año base <span className="font-mono">{r.target_base_year}</span>
              </span>
              <span className={`text-xs font-mono tabular-nums ${
                r.delta_pct > 0 ? 'text-red-400' : r.delta_pct < 0 ? 'text-emerald-400' : 'text-zinc-500'
              }`}>
                Δ {r.delta_pct > 0 ? '+' : ''}{r.delta_pct.toFixed(2)}%
              </span>
              {r.exceeds_threshold && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  excede threshold
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 truncate">{r.reason}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r.applied ? (
            <Badge variant="success">
              <Check className="h-3 w-3 mr-0.5 inline" />
              Aplicado
            </Badge>
          ) : (
            <Badge variant="warning">Pendiente</Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pl-5 space-y-3">
          <SnapshotDiff
            pre={r.pre_recalc_snapshot}
            post={r.post_recalc_snapshot}
          />
          <div className="text-[11px] text-zinc-500 space-y-0.5">
            <div>Propuesto el {new Date(r.proposed_at).toLocaleString('es-ES')}</div>
            {r.applied_at && <div>Aplicado el {new Date(r.applied_at).toLocaleString('es-ES')}</div>}
            {r.applied_notes && <div className="italic">"{r.applied_notes}"</div>}
            <div>Threshold vigente: {Number(r.threshold_pct_at_time).toFixed(1)}%</div>
          </div>
          {onApply && (
            <button
              onClick={onApply}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Aplicar recálculo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
