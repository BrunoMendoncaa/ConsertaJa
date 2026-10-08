'use client';

import { createContext, useContext, useRef, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Alert } from './alert';
import { buttonClasses } from './button';
import { cn } from '@/lib/cn';

const FormStateContext = createContext({ state: null, pending: false });

export function useActionFormState() {
  return useContext(FormStateContext);
}

/**
 * Formulário ligado a uma Server Action com assinatura (prevState, formData).
 * - Mostra o erro geral e a mensagem de sucesso devolvidos pela action.
 * - Mantém o que o usuário digitou quando há erro (não reseta o formulário).
 * - A action pode chamar redirect() normalmente.
 */
export function ActionForm({ action, children, className, resetOnSuccess = false, confirm, onSuccess, id }) {
  const [state, setState] = useState(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef(null);

  function handleSubmit(event) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const form = event.currentTarget;
    const formData = new FormData(form, event.nativeEvent?.submitter);
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result ?? null);
      if (result?.ok) {
        if (resetOnSuccess) form.reset();
        onSuccess?.(result);
      }
    });
  }

  return (
    <FormStateContext.Provider value={{ state, pending }}>
      <form ref={formRef} id={id} onSubmit={handleSubmit} className={className} noValidate>
        {state?.error && (
          <Alert variant="error" className="col-span-full mb-4">
            {state.error}
            {state.ref && <span className="ml-1 text-xs opacity-70">(código {state.ref})</span>}
          </Alert>
        )}
        {state?.ok && state?.message && (
          <Alert variant="success" className="col-span-full mb-4">{state.message}</Alert>
        )}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function FieldError({ name }) {
  const { state } = useActionFormState();
  const message = name ? state?.fieldErrors?.[name] : null;
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

export function SubmitButton({ children, pendingText, variant, size, className, name, value, ...props }) {
  const { pending } = useActionFormState();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || props.disabled}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Mostra conteúdo extra só quando a action devolveu algo (ex.: link de convite). */
export function ActionResult({ render, className }) {
  const { state } = useActionFormState();
  if (!state?.ok || !state?.data) return null;
  return <div className={cn(className)}>{render(state.data)}</div>;
}
