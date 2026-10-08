// Regras do certificado de garantia (sem acesso a banco: fácil de testar).

/** Condições usadas quando a assistência não escreveu a própria política de garantia. */
export const DEFAULT_WARRANTY_TERMS = [
  'A garantia cobre somente os serviços executados e as peças substituídas descritos neste certificado.',
  'A garantia perde a validade em caso de quedas, impactos, trincas ou pressão no aparelho; contato com líquidos, umidade ou oxidação; abertura do equipamento ou violação de lacres por terceiros; descargas elétricas, uso de carregadores ou acessórios inadequados; ou uso em desacordo com as orientações do fabricante.',
  'Defeitos em outras peças ou funções que não fizeram parte do serviço não são cobertos.',
  'Para acionar a garantia, traga o equipamento com este certificado (ou informe o número da OS) dentro do prazo.',
];

export const LEGAL_WARRANTY_NOTE =
  'Esta garantia contratual é complementar à garantia legal prevista no Código de Defesa do Consumidor (arts. 26 e 50).';

/** Dias inteiros entre duas datas "YYYY-MM-DD" (ou timestamps). */
function daysBetween(from, to) {
  const day = (v) => {
    const s = typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
    return Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  };
  return Math.round((day(to) - day(from)) / 86400000);
}

/**
 * Decide qual documento a retirada gera.
 * - 'certificate': reparado e com garantia (prazo > 0)
 * - 'no_warranty': reparado, mas o orçamento aprovado tinha garantia de 0 dia
 * - 'pickup': devolvido sem reparo (orçamento recusado ou reparo inviável)
 * - null: OS ainda não entregue (sem documento de retirada)
 */
export function warrantyDocument(order, approvedBudget) {
  if (!order || order.status !== 'ENTREGUE') return null;
  if (order.outcome !== 'REPARADO') return { kind: 'pickup' };

  const days = approvedBudget?.warranty_days
    ?? approvedBudget?.snapshot?.terms?.warranty_days
    ?? (order.warranty_until && order.delivered_at ? daysBetween(order.delivered_at, order.warranty_until) : 0);

  if (!days || !order.warranty_until) return { kind: 'no_warranty' };
  return { kind: 'certificate', days, startsAt: order.delivered_at, endsAt: order.warranty_until };
}

/** Texto das condições: a política da assistência (um item por linha) ou o padrão. */
export function warrantyTerms(policy) {
  const custom = String(policy || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
  return custom.length ? custom : DEFAULT_WARRANTY_TERMS;
}
