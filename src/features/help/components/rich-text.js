import { splitBold } from '@/features/help/text';

/** Texto dos guias: **trechos** viram negrito (nomes de botões e campos). */
export function RichText({ text }) {
  return splitBold(text).map((p, i) =>
    p.bold
      ? <strong key={i} className="font-semibold text-slate-900">{p.text}</strong>
      : <span key={i}>{p.text}</span>
  );
}
