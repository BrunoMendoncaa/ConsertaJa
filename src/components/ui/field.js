import { Label } from './input';
import { FieldError } from './action-form';

/** Rótulo + controle + dica + erro do campo (vindo do ActionForm). */
export function Field({ label, name, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </Label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}
