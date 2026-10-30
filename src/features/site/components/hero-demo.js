'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Topo da landing: celular com o vídeo curto do sistema (sem som, em loop) e os 3 passos ao lado.
 * O passo do momento fica destacado conforme o vídeo anda; tocar num passo pula para ele.
 * O vídeo só toca quando aparece na tela, e não toca para quem pediu menos movimento ou
 * economia de dados (aí fica a primeira imagem, e tocar num passo começa o vídeo).
 * steps: [{ at: segundos, title, text }]
 */
export function HeroDemo({ src, webm, poster, steps, label }) {
  const video = useRef(null);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection?.saveData;
    const onTime = () => {
      let i = 0;
      steps.forEach((s, idx) => { if (v.currentTime >= s.at) i = idx; });
      setActive(i);
    };
    v.addEventListener('timeupdate', onTime);
    if (reduced || saveData || typeof IntersectionObserver === 'undefined') return () => v.removeEventListener('timeupdate', onTime);
    setAuto(true);
    v.muted = true; // garante o "sem som" antes de tocar (Safari só deixa tocar sozinho assim)
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => { io.disconnect(); v.removeEventListener('timeupdate', onTime); };
  }, [steps]);

  function goTo(i) {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.currentTime = steps[i].at + 0.05;
    setActive(i);
    v.play().catch(() => {});
  }

  return (
    <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
      <div className="w-[6.75rem] shrink-0 max-[359px]:w-[5.75rem] rounded-[1.35rem] bg-slate-900 p-1 shadow-xl shadow-slate-900/30 ring-1 ring-slate-900/10 sm:w-[9rem] sm:rounded-[1.8rem] sm:p-1.5 lg:w-[16rem] lg:rounded-[2.4rem] lg:p-2">
        <video
          ref={video}
          className="block aspect-[540/1168] w-full rounded-[1.1rem] bg-white sm:rounded-[1.45rem] lg:rounded-[1.95rem]"
          poster={poster}
          muted
          loop
          playsInline
          preload={auto ? 'auto' : 'metadata'}
          aria-label={label}
        >
          <source src={src} type="video/mp4" />
          {webm && <source src={webm} type="video/webm" />}
        </video>
      </div>
      <ol className="min-w-0 flex-1 space-y-2 sm:space-y-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => goTo(i)}
              data-track={`hero-passo-${i + 1}`}
              aria-current={active === i ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors sm:gap-3 sm:px-3 sm:py-2.5',
                active === i ? 'bg-white shadow-md shadow-slate-900/10 ring-1 ring-slate-200' : 'opacity-70 hover:opacity-100'
              )}
            >
              <span className={cn(
                'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:size-7 sm:text-sm',
                active === i ? 'bg-accent-500 text-slate-900' : 'bg-slate-200 text-slate-600'
              )}>{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-slate-900 sm:text-base">{s.title}</span>
                <span className="block text-xs leading-snug text-slate-600 max-[359px]:hidden sm:text-sm">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
