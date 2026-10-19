'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NO_TRACK_KEY, CAMPAIGN_PATHS } from '@/features/analytics/constants';

// Conta visitas e cliques nas páginas públicas (landing, cadastro, entrar).
// Sem cookie: a visita é um código aleatório guardado só enquanto a aba está aberta
// (sessionStorage). Cliques contam em links com o atributo data-track="nome-do-botao".

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

function storage(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function sessionId() {
  const s = storage('session');
  let id = s?.getItem('tf_visita');
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, '');
    s?.setItem('tf_visita', id);
  }
  return id;
}

/** Campanha da visita: vale a primeira que apareceu nesta aba (ex.: veio do WhatsApp e foi ao cadastro). */
function campaign() {
  const s = storage('session');
  const params = new URLSearchParams(window.location.search);
  const fromUrl = Object.fromEntries(UTM_KEYS.map((k) => [k, params.get(k)]).filter(([, v]) => v));
  // Link curto de campanha (ex.: /14dias) vale como utm para o resto da visita.
  if (!Object.keys(fromUrl).length && CAMPAIGN_PATHS[window.location.pathname]) {
    Object.assign(fromUrl, CAMPAIGN_PATHS[window.location.pathname]);
  }
  if (Object.keys(fromUrl).length) {
    s?.setItem('tf_campanha', JSON.stringify(fromUrl));
    return fromUrl;
  }
  try {
    return JSON.parse(s?.getItem('tf_campanha') || '{}');
  } catch {
    return {};
  }
}

function send(payload) {
  if (storage('local')?.getItem(NO_TRACK_KEY) === '1') return;
  try {
    fetch('/api/site/evento', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionId(), ...campaign(), ...payload }),
    }).catch(() => {});
  } catch {
    // contagem nunca atrapalha a navegação
  }
}

export function SiteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const s = storage('session');
    // De onde veio só importa na primeira página da visita.
    const first = !s?.getItem('tf_visita');
    send({ event: 'page_view', path: window.location.pathname, ref: first ? document.referrer : null });
  }, [pathname]);

  useEffect(() => {
    function onClick(e) {
      const el = e.target instanceof Element ? e.target.closest('[data-track]') : null;
      if (el) send({ event: 'cta_click', path: window.location.pathname, label: el.getAttribute('data-track') });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
