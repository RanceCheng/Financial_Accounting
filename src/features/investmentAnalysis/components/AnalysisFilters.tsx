import { ASSET_TYPE_LABELS, CURRENCY_LABELS, MARKET_LABELS, AssetType, Currency, Market } from '@/lib/constants'

export interface AnalysisFilterState {
  assetTypes: AssetType[]
  currencies: Currency[]
  markets: Market[]
  onlyHolding: boolean
}

interface Props {
  filters: AnalysisFilterState
  onChange: (f: AnalysisFilterState) => void
}

const ALL_ASSET_TYPES: AssetType[] = ['tw_stock', 'us_stock', 'jp_stock', 'fund']
const ALL_CURRENCIES: Currency[]   = ['TWD', 'USD', 'JPY', 'CNY']
const ALL_MARKETS: Market[]        = ['TW', 'US', 'JP', 'CN', 'OTHER']

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
}

function ChipGroup<T extends string>({
  label, options, labels, selected, onChange,
}: { label: string; options: T[]; labels: Record<string, string>; selected: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500 shrink-0 w-12">{label}</span>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(toggle(selected, o))}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            selected.includes(o)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {labels[o] ?? o}
        </button>
      ))}
      <button
        onClick={() => onChange(selected.length === options.length ? [] : [...options])}
        className="text-xs text-blue-500 hover:underline ml-1"
      >
        {selected.length === options.length ? '全消' : '全選'}
      </button>
    </div>
  )
}

export function AnalysisFilters({ filters, onChange }: Props) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
      <ChipGroup
        label="類型"
        options={ALL_ASSET_TYPES}
        labels={ASSET_TYPE_LABELS}
        selected={filters.assetTypes}
        onChange={v => onChange({ ...filters, assetTypes: v })}
      />
      <ChipGroup
        label="幣別"
        options={ALL_CURRENCIES}
        labels={CURRENCY_LABELS}
        selected={filters.currencies}
        onChange={v => onChange({ ...filters, currencies: v })}
      />
      <ChipGroup
        label="市場"
        options={ALL_MARKETS}
        labels={MARKET_LABELS}
        selected={filters.markets}
        onChange={v => onChange({ ...filters, markets: v })}
      />
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.onlyHolding}
          onChange={e => onChange({ ...filters, onlyHolding: e.target.checked })}
          className="rounded"
        />
        只顯示持有中（持有數量 &gt; 0）
      </label>
    </div>
  )
}

export const DEFAULT_FILTERS: AnalysisFilterState = {
  assetTypes: [...ALL_ASSET_TYPES],
  currencies: [...ALL_CURRENCIES],
  markets: [...ALL_MARKETS],
  onlyHolding: true,
}
