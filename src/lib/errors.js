import { logError } from '@/lib/logger';

// Mensagens específicas por constraint (o nome aparece na mensagem do Postgres).
const CONSTRAINT_MESSAGES = {
  customers_phone_unique: 'Já existe um cliente com este telefone nesta assistência.',
  customers_document_unique: 'Já existe um cliente com este CPF/CNPJ.',
  customers_phone_valid: 'Informe um telefone válido com DDD.',
  customers_name_check: 'Informe o nome do cliente.',
  customers_document_format: 'CPF/CNPJ inválido.',
  assistances_slug_unique: 'Este endereço já está em uso. Escolha outro.',
  assistances_slug_format: 'O endereço deve ter de 3 a 50 caracteres: letras minúsculas, números e hífens.',
  assistances_name_check: 'Informe o nome da assistência (mínimo de 2 caracteres).',
  assistances_document_format: 'CNPJ/CPF da assistência inválido.',
  assistances_brand_color_format: 'Cor inválida. Use o formato #1d4ed8.',
  equipment_imei_format: 'O IMEI deve ter 15 dígitos.',
  equipment_categories_name_unique: 'Já existe uma categoria com este nome.',
  service_orders_issue_check: 'Descreva o problema relatado (mínimo de 3 caracteres).',
  budget_items_discount_limit: 'O desconto do item não pode ser maior que o valor do item.',
  budget_items_quantity_positive: 'A quantidade precisa ser maior que zero.',
  budget_items_price_positive: 'O valor unitário não pode ser negativo.',
  budget_versions_one_open: 'Esta OS já tem um orçamento em aberto.',
  budget_versions_days_check: 'O prazo deve ficar entre 1 e 365 dias.',
  suppliers_name_unique: 'Já existe um fornecedor com este nome.',
  cash_amount_positive: 'O valor precisa ser maior que zero.',
  cash_os_required: 'Selecione a OS deste lançamento.',
  cash_direction_matches_category: 'A categoria não combina com o tipo de lançamento.',
  photos_path_prefix: 'Caminho de arquivo inválido.',
  photos_size_check: 'A foto deve ter no máximo 10 MB.',
  photos_mime_check: 'Formato de imagem não suportado. Use JPG, PNG ou WebP.',
};

const CODE_MESSAGES = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Este registro está ligado a outros dados e a operação não pode ser concluída.',
  '23514': 'Verifique os dados informados.',
  '23502': 'Preencha todos os campos obrigatórios.',
  '22P02': 'Algum valor informado está em formato inválido.',
  '22003': 'Um dos valores informados é grande demais.',
  PT401: 'Sua sessão expirou. Entre novamente.',
  PGRST301: 'Sua sessão expirou. Entre novamente.',
};

const DB_NOT_READY_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883']);
export const DB_NOT_READY_MESSAGE =
  'O banco de dados ainda não foi preparado. Quem cuida do sistema precisa rodar o script de instalação do banco (veja o README, seção “Preparar o banco”).';

/**
 * Converte um erro do Supabase/Postgres em mensagem amigável.
 * Regras de negócio do banco (P0001) já vêm escritas para o usuário.
 */
export function friendlyMessage(error, fallback = 'Não foi possível concluir a operação. Tente novamente.') {
  if (!error) return null;
  const code = error.code;
  const message = String(error.message || '');

  if (code === 'P0001' || code === 'PT401' || code === 'PT429') return message || fallback;

  // Tabela ou função inexistente: o banco do Supabase ainda não recebeu as migrations.
  if (DB_NOT_READY_CODES.has(code)) return DB_NOT_READY_MESSAGE;

  if (code === '42501') {
    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Você não tem permissão para esta ação.';
    }
    return message || 'Você não tem permissão para esta ação.';
  }

  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint) || String(error.details || '').includes(constraint)) return text;
  }

  return CODE_MESSAGES[code] || fallback;
}

/**
 * Para Server Actions: registra o erro técnico e devolve o estado do formulário.
 * @returns {{ ok: false, error: string, ref?: string }}
 */
export function actionError(context, error, fallback) {
  const isBusinessRule = error?.code === 'P0001';
  const ref = isBusinessRule ? undefined : logError(context, error);
  return { ok: false, error: friendlyMessage(error, fallback), ref };
}
