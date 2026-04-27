'use client'

import { useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Edit3, Save, X, Loader2, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  detectHotspots,
  resolveMateriality,
  SCOPE_CATEGORIES_ORDER,
  SCOPE_CATEGORY_LABELS,
} from '@/lib/materiality/resolve'
import type {
  IndustryMateriality,
  MaterialityLevel,
  NaceSector,
  Organization,
  OrgMaterialityOverride,
  ScopeCategory,
} from '@/types/database'

interface Props {
  organization: Organization
  sectors: NaceSector[]
  catalog: IndustryMateriality[]
  overrides: OrgMaterialityOverride[]
  latestInventoryEntries: {
    scope: string | null
    category: string | null
    tco2e: number | null
    emission_factors?: { s3_category: number | null }[] | null
  }[]
  latestInventoryYear: number | null
  isAdmin: boolean
}

const levelLabel: Record<MaterialityLevel, string> = {
  0: 'No material',
  1: 'Potencial',
  2: 'Material',
  3: 'Alta materialidad',
}

const levelColor: Record<MaterialityLevel, string> = {
  0: 'bg-zinc-800/40 text-zinc-500',
  1: 'bg-blue-500/15 text-blue-300',
  2: 'bg-amber-500/20 text-amber-300',
  3: 'bg-red-500/25 text-red-300',
}

export function MaterialityManager({
  organization,
  sectors,
  catalog,
  overrides,
  latestInventoryEntries,
  latestInventoryYear,
  isAdmin,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [editingSectors, setEditingSectors] = useState(false)
  const [selectedSectors, setSelectedSectors] = useState<string[]>(organization.sectors ?? [])
  const [overrideTarget, setOverrideTarget] =
    useState<{ sectorCode: string; scopeCategory: ScopeCategory } | null>(null)
  const [overrideLevel, setOverrideLevel] = useState<MaterialityLevel>(2)
  const [overrideJustification, setOverrideJustification] = useState('')

  // Sectores actuales de la org (filtrados a los que existen en el catálogo)
  const orgSectors = useMemo(
    () => (organization.sectors ?? []).filter((s) => sectors.some((n) => n.code === s)),
    [organization.sectors, sectors]
  )

  const sectorByCode = useMemo(
    () => new Map(sectors.map((s) => [s.code, s])),
    [sectors]
  )

  // Hotspots material (≥2) sin datos — usa el helper compartido con dashboard.
  // S3 evaluadas a nivel de categoría 1-15 vía emission_factors.s3_category.
  const hotspots = useMemo(
    () => detectHotspots(orgSectors, latestInventoryEntries, catalog, overrides),
    [orgSectors, latestInventoryEntries, catalog, overrides]
  )

  async function handleSaveSectors() {
    setFeedback(null)
    startTransition(async () => {
      const { error } = await supabase
        .from('organizations')
        .update({ sectors: selectedSectors })
        .eq('id', organization.id)
      if (error) {
        setFeedback({ ok: false, msg: error.message })
        return
      }
      setEditingSectors(false)
      setFeedback({ ok: true, msg: 'Sectores actualizados.' })
      router.refresh()
    })
  }

  function openOverrideModal(sectorCode: string, scopeCategory: ScopeCategory) {
    if (!isAdmin) return
    const existing = overrides.find(
      (o) => o.sector_code === sectorCode && o.scope_category === scopeCategory
    )
    const resolved = resolveMateriality(sectorCode, scopeCategory, catalog, overrides)
    setOverrideTarget({ sectorCode, scopeCategory })
    setOverrideLevel(existing ? existing.materiality : resolved.level)
    setOverrideJustification(existing?.justification ?? '')
  }

  async function handleSaveOverride() {
    if (!overrideTarget || !overrideJustification.trim()) return
    setFeedback(null)
    startTransition(async () => {
      const existing = overrides.find(
        (o) =>
          o.sector_code === overrideTarget.sectorCode &&
          o.scope_category === overrideTarget.scopeCategory
      )
      if (existing) {
        const { error } = await supabase
          .from('org_materiality_overrides')
          .update({
            materiality: overrideLevel,
            justification: overrideJustification.trim(),
          })
          .eq('id', existing.id)
        if (error) {
          setFeedback({ ok: false, msg: error.message })
          return
        }
      } else {
        const { error } = await supabase.from('org_materiality_overrides').insert({
          organization_id: organization.id,
          sector_code: overrideTarget.sectorCode,
          scope_category: overrideTarget.scopeCategory,
          materiality: overrideLevel,
          justification: overrideJustification.trim(),
        })
        if (error) {
          setFeedback({ ok: false, msg: error.message })
          return
        }
      }
      setOverrideTarget(null)
      setOverrideJustification('')
      setFeedback({ ok: true, msg: 'Override guardado.' })
      router.refresh()
    })
  }

  async function handleRemoveOverride(id: string) {
    if (!confirm('¿Eliminar este override y volver al valor del catálogo?')) return
    startTransition(async () => {
      const { error } = await supabase.from('org_materiality_overrides').delete().eq('id', id)
      if (error) {
        setFeedback({ ok: false, msg: error.message })
        return
      }
      router.refresh()
    })
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {feedback && (
        <p
          className={`text-[11px] rounded px-2.5 py-1.5 border ${
            feedback.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      {/* Sectores de la org */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Sectores NACE de la organización</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {orgSectors.length === 0
                ? 'Sin sectores configurados.'
                : `${orgSectors.length} ${orgSectors.length === 1 ? 'sector' : 'sectores'} activo${orgSectors.length === 1 ? '' : 's'}.`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setEditingSectors((v) => !v)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editingSectors ? 'Cancelar' : 'Editar'}
            </button>
          )}
        </div>

        <div className="p-6">
          {editingSectors ? (
            <SectorPicker
              sectors={sectors}
              selected={selectedSectors}
              onChange={setSelectedSectors}
              onSave={handleSaveSectors}
              pending={pending}
            />
          ) : orgSectors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {orgSectors.map((code) => {
                const s = sectorByCode.get(code)
                return (
                  <Badge key={code} variant="info">
                    {code} · {s?.label_es ?? '?'}
                  </Badge>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">
              Aún no has asignado sectores. Edítalos para ver tu matriz de materialidad.
            </p>
          )}
        </div>
      </div>

      {/* Hotspots sin cubrir */}
      {hotspots.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Hotspots sin cubrir ({hotspots.length})
          </h2>
          <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
            Categorías marcadas como <strong>material</strong> o <strong>alta materialidad</strong>{' '}
            en tu sector que aún no tienen entradas en el inventario {latestInventoryYear ?? 'actual'}.
            Las S3 se evalúan a nivel de categoría 1–15 cruzando{' '}
            <code className="text-zinc-400">emission_factors.s3_category</code>. Si una entry S3 no
            tiene esa columna mapeada todavía, marcamos la cobertura como{' '}
            <em>incierta</em> (warning textual al lado de cada hotspot).
          </p>
          <div className="space-y-1.5">
            {hotspots.map((h, i) => (
              <div
                key={`${h.sectorCode}-${h.scopeCategory}-${i}`}
                className="flex items-center gap-2 text-[11px] text-zinc-300"
              >
                <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-mono ${levelColor[h.level]}`}>
                  {h.level}
                </span>
                <Badge variant="default">{h.sectorCode}</Badge>
                <span>{SCOPE_CATEGORY_LABELS[h.scopeCategory]}</span>
                {h.uncertain && (
                  <span className="text-[10px] text-amber-400 italic">cobertura incierta · alguna entry S3 sin s3_category mapeado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matriz de materialidad */}
      {orgSectors.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Matriz de materialidad</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-3">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-zinc-700" /> 0 No material
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-blue-500/60" /> 1 Potencial
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-amber-500/60" /> 2 Material
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-red-500/60" /> 3 Alta materialidad
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500 sticky left-0 bg-zinc-900 z-10">
                    Categoría
                  </th>
                  {orgSectors.map((code) => (
                    <th
                      key={code}
                      className="px-3 py-2 text-center text-[10px] font-medium text-zinc-400 min-w-[100px]"
                      title={sectorByCode.get(code)?.label_es ?? ''}
                    >
                      {code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {SCOPE_CATEGORIES_ORDER.map((sc) => (
                  <tr key={sc} className="hover:bg-zinc-800/20">
                    <td className="px-4 py-2 text-zinc-300 sticky left-0 bg-zinc-950/80 backdrop-blur z-10 whitespace-nowrap">
                      {SCOPE_CATEGORY_LABELS[sc]}
                    </td>
                    {orgSectors.map((code) => {
                      const r = resolveMateriality(code, sc, catalog, overrides)
                      const overridden = r.source === 'override'
                      const overrideRow = overrides.find(
                        (o) => o.sector_code === code && o.scope_category === sc
                      )
                      return (
                        <td key={code} className="px-2 py-1 text-center">
                          <button
                            onClick={() => openOverrideModal(code, sc)}
                            disabled={!isAdmin}
                            title={`${levelLabel[r.level]} · ${r.source}${r.notes ? ` · ${r.notes}` : ''}${
                              overridden ? ' (override)' : r.source === 'inherit' && r.resolved_from !== code ? ` (heredado de ${r.resolved_from})` : ''
                            }`}
                            className={`inline-flex items-center justify-center h-7 w-9 rounded text-[11px] font-mono ${levelColor[r.level]} ${
                              isAdmin ? 'hover:ring-2 hover:ring-emerald-500/50 cursor-pointer' : 'cursor-default'
                            } ${overridden ? 'ring-1 ring-emerald-400' : ''}`}
                          >
                            {r.level}
                          </button>
                          {overrideRow && isAdmin && (
                            <button
                              onClick={() => handleRemoveOverride(overrideRow.id)}
                              className="block mx-auto mt-0.5 text-[9px] text-zinc-500 hover:text-red-400 transition-colors"
                              title="Eliminar override"
                            >
                              ↺
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal override */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Override de materialidad
              </h3>
              <button
                onClick={() => setOverrideTarget(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400">
              Sector <Badge variant="info">{overrideTarget.sectorCode}</Badge>
              {' · '}{SCOPE_CATEGORY_LABELS[overrideTarget.scopeCategory]}
            </p>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1.5">Nivel</label>
              <div className="grid grid-cols-4 gap-2">
                {([0, 1, 2, 3] as MaterialityLevel[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setOverrideLevel(l)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      overrideLevel === l
                        ? 'bg-emerald-600 text-white'
                        : `${levelColor[l]} hover:opacity-80`
                    }`}
                  >
                    {l} · {levelLabel[l]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Justificación (obligatoria)</label>
              <textarea
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                rows={3}
                placeholder="Por qué este sector tiene un nivel distinto al del catálogo (queda auditado)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOverrideTarget(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={pending || !overrideJustification.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Guardar override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectorPicker({
  sectors,
  selected,
  onChange,
  onSave,
  pending,
}: {
  sectors: NaceSector[]
  selected: string[]
  onChange: (s: string[]) => void
  onSave: () => void
  pending: boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = sectors.filter((s) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return s.code.toLowerCase().includes(q) || s.label_es.toLowerCase().includes(q)
  })

  function toggle(code: string) {
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code))
    else onChange([...selected, code])
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar sector NACE (código o nombre)…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800/50">
        {filtered.map((s) => {
          const isSelected = selected.includes(s.code)
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => toggle(s.code)}
              className={`flex items-center gap-3 w-full px-3 py-2 text-left text-xs transition-colors ${
                isSelected ? 'bg-emerald-500/10 text-white' : 'hover:bg-zinc-800/40 text-zinc-300'
              }`}
            >
              <span className={`inline-flex items-center justify-center h-4 w-4 rounded border ${
                isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-700'
              }`}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </span>
              <span className="font-mono w-14 shrink-0">{s.code}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-16 shrink-0">{s.level}</span>
              <span className="truncate">{s.label_es}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{selected.length} seleccionado{selected.length === 1 ? '' : 's'}</span>
        <button
          onClick={onSave}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar sectores
        </button>
      </div>
    </div>
  )
}
