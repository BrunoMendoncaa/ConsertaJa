import { TEST_PLANS } from '@/features/admin/format';

/** Escolha do plano da conta de teste (Pro ou Grátis), em cartões com rádio. */
export function PlanChoice({ name = 'plan', defaultValue = 'pro', idPrefix = 'plano', compact = false }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">Plano da conta de teste</legend>
      <div className={compact ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-2'}>
        {Object.entries(TEST_PLANS).map(([key, p]) => (
          <label key={key} htmlFor={`${idPrefix}-${key}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/60 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
            <input id={`${idPrefix}-${key}`} type="radio" name={name} value={key} defaultChecked={key === defaultValue}
              className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="block text-sm font-medium text-slate-900">{p.label}</span>
              <span className="block text-xs text-slate-500">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
