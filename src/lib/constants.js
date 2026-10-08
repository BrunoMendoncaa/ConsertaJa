// Rótulos e regras compartilhados entre telas. O banco é quem valida;
// estes mapas só servem para exibir e para oferecer as opções certas.

export const ROLES = {
  owner: 'Proprietário',
  admin: 'Administrador',
  technician: 'Técnico',
  attendant: 'Atendente',
};

export const TECH_ROLES = ['owner', 'admin', 'technician'];
export const MANAGER_ROLES = ['owner', 'admin'];
export const ALL_ROLES = ['owner', 'admin', 'technician', 'attendant'];

export const OS_STATUS = {
  RECEBIDO: { label: 'Recebido', tone: 'slate', customer: 'Recebemos seu equipamento' },
  EM_DIAGNOSTICO: { label: 'Em diagnóstico', tone: 'indigo', customer: 'Em análise técnica' },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', tone: 'amber', customer: 'Aguardando sua aprovação' },
  ORCAMENTO_RECUSADO: { label: 'Orçamento recusado', tone: 'red', customer: 'Orçamento recusado' },
  APROVADO: { label: 'Aprovado', tone: 'emerald', customer: 'Orçamento aprovado' },
  AGUARDANDO_PECA: { label: 'Aguardando peça', tone: 'orange', customer: 'Aguardando peça' },
  EM_MANUTENCAO: { label: 'Em manutenção', tone: 'blue', customer: 'Em manutenção' },
  PRONTO: { label: 'Pronto para retirada', tone: 'teal', customer: 'Pronto para retirada' },
  ENTREGUE: { label: 'Entregue', tone: 'green', customer: 'Entregue' },
  CANCELADO: { label: 'Cancelado', tone: 'zinc', customer: 'Cancelado' },
};

export const OS_STATUS_ORDER = [
  'RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'ORCAMENTO_RECUSADO', 'APROVADO',
  'AGUARDANDO_PECA', 'EM_MANUTENCAO', 'PRONTO', 'ENTREGUE', 'CANCELADO',
];

export const OPEN_STATUSES = OS_STATUS_ORDER.filter((s) => !['ENTREGUE', 'CANCELADO'].includes(s));

export const OUTCOMES = {
  REPARADO: 'Reparado',
  NAO_REPARADO_RECUSADO: 'Devolvido sem reparo (orçamento recusado)',
  NAO_REPARADO_INVIAVEL: 'Devolvido sem reparo (reparo inviável)',
};

// Transições manuais permitidas (espelho da função change_service_order_status).
// As mudanças ligadas ao orçamento acontecem sozinhas e não aparecem aqui.
export const MANUAL_TRANSITIONS = {
  RECEBIDO: [{ to: 'EM_DIAGNOSTICO', label: 'Iniciar diagnóstico', roles: TECH_ROLES }],
  EM_DIAGNOSTICO: [
    { to: 'PRONTO', label: 'Reparo inviável: liberar para devolução', roles: TECH_ROLES, needsNote: false },
  ],
  ORCAMENTO_RECUSADO: [
    { to: 'PRONTO', label: 'Devolver sem reparo', roles: ALL_ROLES },
    { to: 'EM_MANUTENCAO', label: 'Seguir com o orçamento aprovado anterior', roles: TECH_ROLES },
  ],
  APROVADO: [
    { to: 'EM_MANUTENCAO', label: 'Iniciar manutenção', roles: TECH_ROLES },
    { to: 'AGUARDANDO_PECA', label: 'Aguardar peça', roles: TECH_ROLES },
  ],
  AGUARDANDO_PECA: [{ to: 'EM_MANUTENCAO', label: 'Peça chegou: retomar manutenção', roles: TECH_ROLES }],
  EM_MANUTENCAO: [
    { to: 'PRONTO', label: 'Concluir reparo', roles: TECH_ROLES },
    { to: 'AGUARDANDO_PECA', label: 'Aguardar peça', roles: TECH_ROLES },
  ],
  PRONTO: [
    { to: 'ENTREGUE', label: 'Registrar entrega', roles: ALL_ROLES },
    { to: 'EM_MANUTENCAO', label: 'Reabrir reparo', roles: TECH_ROLES, needsNote: true },
  ],
  ENTREGUE: [],
  CANCELADO: [],
};

export const PRIORITIES = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const BUDGET_STATUS = {
  RASCUNHO: { label: 'Rascunho', tone: 'slate' },
  ENVIADO: { label: 'Aguardando cliente', tone: 'amber' },
  APROVADO: { label: 'Aprovado', tone: 'emerald' },
  RECUSADO: { label: 'Recusado', tone: 'red' },
  SUBSTITUIDO: { label: 'Substituído', tone: 'zinc' },
  CANCELADO: { label: 'Cancelado', tone: 'zinc' },
};

export const DECISION_CHANNELS = {
  PORTAL: 'Portal do cliente',
  BALCAO: 'No balcão',
  TELEFONE: 'Por telefone',
  WHATSAPP: 'Por WhatsApp',
};

export const ITEM_KINDS = { PECA: 'Peça', SERVICO: 'Serviço' };

export const ACCESSORIES = [
  'Carregador', 'Cabo', 'Fonte', 'Capa', 'Película', 'Chip', 'Cartão de memória',
  'Controle remoto', 'Bateria', 'Caixa', 'Fone de ouvido', 'Mouse/Teclado',
];

export const ENTRY_CHECKLIST = [
  { key: 'liga', label: 'Liga' },
  { key: 'tela_trincada', label: 'Tela trincada' },
  { key: 'riscos', label: 'Riscos ou arranhões' },
  { key: 'amassados', label: 'Amassados' },
  { key: 'oxidacao', label: 'Sinais de oxidação/umidade' },
  { key: 'parafusos_faltando', label: 'Parafusos faltando' },
  { key: 'lacre_violado', label: 'Lacre violado' },
];

export const PHOTO_KINDS = {
  FRENTE: 'Frente',
  TRASEIRA: 'Traseira',
  LATERAL: 'Lateral',
  TELA: 'Tela',
  CONECTOR: 'Conector',
  ETIQUETA: 'Etiqueta',
  NUMERO_SERIE: 'Número de série',
  DANO: 'Dano existente',
  ACESSORIO: 'Acessório',
  OUTRO: 'Outro',
};

export const PHOTO_STAGES = { ENTRADA: 'Entrada', DIAGNOSTICO: 'Diagnóstico', SAIDA: 'Saída' };

export const CASH_CATEGORIES = {
  RECEBIMENTO_OS: { label: 'Recebimento de OS', direction: 'IN' },
  TAXA_DIAGNOSTICO: { label: 'Taxa de diagnóstico', direction: 'IN' },
  OUTRO_RECEBIMENTO: { label: 'Outro recebimento', direction: 'IN' },
  COMPRA_PECA: { label: 'Compra de peça', direction: 'OUT' },
  FORNECEDOR: { label: 'Pagamento a fornecedor', direction: 'OUT' },
  DESPESA_OPERACIONAL: { label: 'Despesa operacional', direction: 'OUT' },
  ESTORNO: { label: 'Estorno ao cliente', direction: 'OUT' },
  OUTRA_SAIDA: { label: 'Outra saída', direction: 'OUT' },
};

export const PAYMENT_METHODS = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto',
  OUTRO: 'Outro',
};

export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
