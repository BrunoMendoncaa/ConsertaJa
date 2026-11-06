'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { signInWithGoogle } from '@/features/auth/actions';
import { chromeIntentUrl } from '@/lib/in-app-browser';

// Marca do Google para botões "Continuar com o Google" (diretrizes de marca do Google Identity).
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const BUTTON = 'flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-70';

function Submit({ label, track }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={BUTTON} disabled={pending} data-track={track}>
      {pending ? <LoaderCircle className="size-5 animate-spin text-slate-500" aria-hidden="true" /> : <GoogleMark />}
      {pending ? 'Abrindo o Google...' : label}
    </button>
  );
}

/**
 * Botão "Continuar com o Google" das telas de cadastro e entrar.
 * mode: 'cadastro' | 'entrar'. next: destino depois de entrar (ex.: convite).
 * inApp: navegador embutido do Instagram/Facebook etc. O Google bloqueia o login ali, então o botão
 * explica como abrir no navegador (no Android, com um botão que abre no Chrome) em vez de dar erro.
 */
export function GoogleButton({ mode, next = '', inApp = false, app = null, android = false }) {
  const [help, setHelp] = useState(false);
  const label = 'Continuar com o Google';
  const track = mode === 'cadastro' ? 'cadastro-google' : 'entrar-google';

  if (inApp) {
    return (
      <div>
        <button type="button" className={BUTTON} data-track="google-navegador-app" aria-expanded={help} onClick={() => setHelp(true)}>
          <GoogleMark /> {label}
        </button>
        {help && (
          <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">O Google não deixa entrar pelo navegador {app ? `do ${app}` : 'deste app'}.</p>
            <p className="mt-1">
              {android ? 'Abra no Chrome e toque de novo em "Continuar com o Google":' : 'Toque nos três pontinhos (···) no canto da tela, escolha abrir no navegador e toque de novo em "Continuar com o Google".'}
            </p>
            {android && (
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); window.location.href = chromeIntentUrl(window.location.href); }}
                data-track="google-abrir-chrome"
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-amber-950 underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" /> Abrir no Chrome
              </a>
            )}
            <p className="mt-2 text-amber-800">Ou {mode === 'cadastro' ? 'crie a conta' : 'entre'} com e-mail e senha aqui embaixo.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <Submit label={label} track={track} />
    </form>
  );
}

/** Linha "ou" entre o botão do Google e o formulário de e-mail. */
export function OrDivider({ children = 'ou com e-mail' }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-200" />{children}<span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
