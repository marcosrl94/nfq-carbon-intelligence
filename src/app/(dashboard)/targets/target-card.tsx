'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'
import type { DecarbTarget } from '@/types/database'

interface Props {
  target: DecarbTarget
  currentByScope: Record<string, number>
  baselineByScope: Record<string, number>
}

function calcProgress(baseline: number, current: number, targetReduction: number): number {
  if (baseline <= 0 || targetReduction <= 0) return 0
  const targetEmissions = baseline * (1 - targetReduction / 100)
  const actualReduction = baseline - current
  const neededReduction = baseline - targetEmissions
  if (neededReduction <= 0) return 100
  return Math.min(Math.round((actualReduction / neededReduction) * 100), 100)
}

export function TargetCard({ target, currentByScope, baselineByScope }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    await supabase.from('decarb_targets').delete().eq('id', target.id)
    router.refresh()
  }

  const progressS1 = target.reduction_s1 != null
    ? calcProgress(baselineByScope.s1, currentByScope.s1, target.reduction_s1)
    : null
  const progressS2 = target.reduction_s2 != null
    ? calcProgress(baselineByScope.s2, currentByScope.s2, target.reduction_s2)
    : null
  const progressS3 = target.reduction_s3 != null
    ? calcProgress(baselineByScope.s3, currentByScope.s3, target.reduction_s3)
    : null

  const yearsLeft = (target.target_year ?? 2030) - new Date().getFullYear()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info">{target.framework ?? 'Custom'}</Badge>
            <Badge variant="default">{target.curve_type}</Badge>
          </div>
          <h3 className="text-base font-semibold text-white mt-2">
            Objetivo {target.target_year}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {yearsLeft > 0 ? `${yearsLeft} años restantes` : yearsLeft === 0 ? 'Año objetivo actual' : 'Plazo vencido'}
          </p>
        </div>
        <button onClick={handleDelete} className="text-zinc-600 hover:text-red-400 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {target.reduction_s1 != null && (
          <ScopeRow
            label="Alcance 1"
            reduction={target.reduction_s1}
            progress={progressS1 ?? 0}
            color="bg-red-500"
          />
        )}
        {target.reduction_s2 != null && (
          <ScopeRow
            label="Alcance 2"
            reduction={target.reduction_s2}
            progress={progressS2 ?? 0}
            color="bg-amber-500"
          />
        )}
        {target.reduction_s3 != null && (
          <ScopeRow
            label="Alcance 3"
            reduction={target.reduction_s3}
            progress={progressS3 ?? 0}
            color="bg-emerald-500"
          />
        )}
      </div>

      {target.levers && Object.keys(target.levers).length > 0 && (
        <div className="pt-3 border-t border-zinc-800/50">
          <p className="text-xs text-zinc-500 mb-2">Palancas de reducción</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(target.levers).map((lever) => (
              <span key={lever} className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {lever}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScopeRow({ label, reduction, progress, color }: {
  label: string
  reduction: number
  progress: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-300">
          <span className="font-medium">{progress}%</span>
          <span className="text-zinc-500"> / -{reduction}%</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.max(progress, 0)}%` }}
        />
      </div>
    </div>
  )
}
