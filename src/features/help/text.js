// Utilitários de texto da central de ajuda (leves, podem ir ao navegador).

/** Remove acentos e caixa para a busca ("orçamento" encontra "orcamento"). */
export function normalizeSearch(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Todas as palavras da busca precisam aparecer no texto (já normalizado). */
export function matchesSearch(haystack, query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  return words.every((w) => haystack.includes(w));
}

/** Divide "Clique em **Salvar**" em pedaços para exibir o negrito sem HTML cru. */
export function splitBold(text) {
  return String(text || '').split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter((p) => p.text);
}
