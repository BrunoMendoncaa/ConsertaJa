import { CASH_CATEGORIES } from '@/lib/constants';

/** Categorias que cada papel pode lançar (espelho da policy cash_insert). */
export function allowedCategories(role) {
  if (role === 'owner' || role === 'admin') return Object.keys(CASH_CATEGORIES);
  if (role === 'technician') return ['RECEBIMENTO_OS', 'TAXA_DIAGNOSTICO', 'COMPRA_PECA'];
  if (role === 'attendant') return ['RECEBIMENTO_OS', 'TAXA_DIAGNOSTICO'];
  return [];
}
