// Central de ajuda ("Como usar"): conteúdo dos guias.
// Texto entre **asteriscos** aparece em negrito (nome de botão ou campo da tela).
// `roles`: quem vê o guia (espelha as permissões reais das telas).
// `media`: arquivos em /public/ajuda (dimensões em media-manifest.js).

import { ALL_ROLES, TECH_ROLES, MANAGER_ROLES, ROLES } from '@/lib/constants';
import { normalizeSearch } from './text';

export const HELP_CATEGORIES = [
  { id: 'comecar', title: 'Primeiros passos', icon: 'rocket' },
  { id: 'os', title: 'Ordens de serviço e orçamento', icon: 'os' },
  { id: 'cliente', title: 'Clientes e portal', icon: 'customers' },
  { id: 'financeiro', title: 'Financeiro e números', icon: 'cash' },
  { id: 'conta', title: 'Equipe, plano e conta', icon: 'users' },
];

export const GUIDES = [
  // ---------------------------------------------------------------- Primeiros passos
  {
    slug: 'comece-por-aqui',
    category: 'comecar',
    title: 'Comece por aqui',
    summary: 'O que configurar no primeiro dia para a assistência ficar pronta para atender.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/configuracoes', label: 'Abrir Configurações' },
    media: [{ type: 'image', file: 'configuracoes.webp', frame: 'desktop', alt: 'Tela de Configurações da assistência', caption: 'Configurações: dados da loja, portal do cliente e padrões de orçamento.' }],
    steps: [
      { title: 'Preencha os dados da assistência', text: 'Logo depois de criar a assistência, o sistema abre **Configurações**. O **WhatsApp** (ou telefone) e o **endereço completo** são obrigatórios: saem no comprovante, no orçamento, no certificado e no portal do cliente.' },
      { title: 'Envie o logo', text: 'Ainda em **Configurações**, no quadro **Logo**. Ele aparece nos documentos impressos e no portal.' },
      { title: 'Defina os padrões do orçamento', text: 'Validade, garantia padrão, taxa de diagnóstico e condições de garantia. Dá para ajustar em cada orçamento depois.' },
      { title: 'Convide a equipe', text: 'Em **Equipe**, gere um convite para cada técnico ou atendente. Cada um entra com o próprio e-mail e vê só o que a função permite.' },
      { title: 'Abra a primeira OS', text: 'Clique em **Nova OS**. Em menos de um minuto você cadastra cliente, aparelho e entrada, e já manda o link de acompanhamento pelo WhatsApp.' },
      { title: 'Conheça os planos', text: 'Os 14 primeiros dias têm o **Pro** completo, grátis. Depois, a conta continua no plano **Grátis** (até 30 OS por mês). Em **Meu plano** você vê os dias que faltam, compara Grátis e Pro e assina pelo Mercado Pago.' },
    ],
    related: ['configurar-assistencia', 'convidar-equipe', 'abrir-os'],
    keywords: ['inicio', 'comecar', 'primeiro dia', 'configurar', 'implantacao'],
  },
  {
    slug: 'como-a-os-anda',
    category: 'comecar',
    title: 'Como uma OS anda, do balcão à entrega',
    summary: 'Os status da ordem de serviço, o que cada um significa e como a OS chega até ele.',
    roles: ALL_ROLES,
    screen: { href: '/painel/os', label: 'Abrir Ordens de serviço' },
    table: {
      title: 'Os status da OS',
      statusColumn: true, // 1ª coluna = código do status (vira o selo colorido usado no sistema)
      columns: ['Status', 'O que significa', 'Como a OS chega aqui'],
      rows: [
        ['RECEBIDO', 'O aparelho deu entrada na loja.', 'Ao criar a OS.'],
        ['EM_DIAGNOSTICO', 'O técnico está analisando o aparelho.', 'Técnico: **Iniciar diagnóstico**.'],
        ['AGUARDANDO_APROVACAO', 'Orçamento enviado, esperando o cliente.', 'Sozinha, ao enviar o orçamento.'],
        ['APROVADO', 'O cliente aprovou o orçamento.', 'Sozinha, quando o cliente aprova no portal ou alguém registra a decisão.'],
        ['ORCAMENTO_RECUSADO', 'O cliente recusou o orçamento.', 'Sozinha, na recusa.'],
        ['AGUARDANDO_PECA', 'O conserto espera uma peça chegar.', 'Técnico: **Aguardar peça**.'],
        ['EM_MANUTENCAO', 'O conserto está em andamento.', 'Técnico: **Iniciar manutenção**.'],
        ['PRONTO', 'Pronto para o cliente buscar.', 'Técnico: **Concluir reparo**, ou devolução sem conserto.'],
        ['ENTREGUE', 'O cliente retirou. A garantia começa a contar.', 'Qualquer pessoa da equipe: **Registrar entrega**.'],
        ['CANCELADO', 'A OS foi encerrada sem entrega.', 'Proprietário ou administrador: **Cancelar OS**, com motivo.'],
      ],
    },
    steps: [
      { title: 'Mude o status no quadro Status', text: 'Na página da OS, escolha a ação em **Próximo passo** e clique em **Atualizar status**. Só aparecem as ações que a sua função pode fazer.' },
      { title: 'Escreva uma nota quando ajudar', text: 'A nota aparece na linha do tempo da OS e também para o cliente, no portal.' },
      { title: 'Acompanhe pela lista', text: 'Em **Ordens de serviço**, filtre por status, técnico ou busque pelo número, cliente, telefone, modelo ou IMEI.' },
    ],
    tips: [
      'Uma OS aparece como **Atrasada** quando passa da previsão de conclusão.',
      'Tudo o que acontece com a OS fica registrado na **Linha do tempo**, com data e quem fez.',
    ],
    related: ['diagnostico-e-status', 'montar-orcamento', 'entrega-e-garantia'],
    keywords: ['status', 'etapas', 'fluxo', 'andamento', 'atrasada'],
  },
  {
    slug: 'configurar-assistencia',
    category: 'comecar',
    title: 'Configurar a assistência',
    summary: 'Dados da loja, logo, cor, portal do cliente e padrões de orçamento e garantia.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/configuracoes', label: 'Abrir Configurações' },
    media: [{ type: 'image', file: 'configuracoes.webp', frame: 'desktop', alt: 'Tela de Configurações da assistência' }],
    steps: [
      { title: 'Identidade', text: 'Nome fantasia, razão social, CNPJ/CPF e **Cor da marca**. A cor é usada no portal e no orçamento.' },
      { title: 'Contato e endereço', text: 'WhatsApp (ou telefone) e endereço completo são obrigatórios. Digite o CEP e rua, bairro, cidade e estado são preenchidos sozinhos. E-mail e horário de atendimento também aparecem no portal, no comprovante e no orçamento.' },
      { title: 'Portal do cliente', text: 'Escreva uma mensagem de boas-vindas e escolha se o cliente pode ver as fotos marcadas como visíveis.' },
      { title: 'Orçamento e garantia', text: 'Validade do orçamento, garantia padrão em dias, taxa de diagnóstico, condições de pagamento, condições de garantia e os termos que saem no comprovante de entrada.' },
      { title: 'Logo e categorias', text: 'Na coluna da direita, envie o logo e crie categorias de equipamento além das que já vêm no sistema.' },
      { title: 'Salve', text: 'Clique em **Salvar configurações**, no fim da página.' },
    ],
    tips: [
      'Enquanto faltar WhatsApp ou endereço, o painel mostra um aviso para completar, e quem é proprietário ou administrador cai em **Configurações** ao entrar.',
      'O endereço do portal (tecnofix.pro/a/sua-loja) não muda depois de criado. QR codes já impressos continuam valendo.',
      'Nas condições de garantia, escreva uma condição por linha. Em branco, o certificado usa condições padrão.',
      'Quando não há prazo combinado, o Código de Defesa do Consumidor considera 10 dias de validade para o orçamento.',
    ],
    related: ['comece-por-aqui', 'comprovante-qr', 'entrega-e-garantia'],
    keywords: ['logo', 'cor', 'endereco', 'cep', 'whatsapp', 'obrigatorio', 'cnpj', 'garantia padrao', 'taxa de diagnostico', 'termos', 'categorias'],
  },

  // ---------------------------------------------------------------- OS e orçamento
  {
    slug: 'abrir-os',
    category: 'os',
    title: 'Abrir uma ordem de serviço',
    summary: 'Cliente, aparelho, checklist de entrada e link para o cliente em menos de 1 minuto.',
    roles: ALL_ROLES,
    screen: { href: '/painel/os/nova', label: 'Abrir Nova OS' },
    media: [{ type: 'video', file: 'videos/nova-os.mp4', poster: 'videos/nova-os.webp', frame: 'desktop', caption: 'Uma OS completa, do cadastro do cliente ao link de acompanhamento.' }],
    steps: [
      { title: 'Clique em Nova OS', text: 'O botão fica no menu e no topo das telas de OS.' },
      { title: 'Cliente', text: 'Busque por telefone, nome ou CPF. Se for a primeira vez, use **Novo cliente**: nome e telefone (WhatsApp) já bastam.' },
      { title: 'Equipamento', text: 'Escolha um aparelho já cadastrado do cliente ou cadastre um novo: categoria, marca, modelo, cor, número de série e IMEI.' },
      { title: 'Entrada', text: 'Descreva o problema relatado, marque os acessórios recebidos e a condição de entrada (tela trincada, riscos…). Se quiser, já defina prioridade, técnico, previsão, senha de desbloqueio e observações.' },
      { title: 'Revisão', text: 'Confira tudo e clique em **Criar OS**.' },
      { title: 'Fotos e link', text: 'Com a OS criada, tire as fotos de entrada e mande o link de acompanhamento com **Enviar no WhatsApp**, ou imprima o comprovante com QR code.' },
    ],
    tips: [
      'Dá para abrir a OS direto da ficha do cliente ou do equipamento: os dados já vêm preenchidos.',
      'As **Observações internas** nunca aparecem para o cliente.',
      'No plano **Grátis** dá para abrir até 30 OS por mês; o contador aparece no menu. Atingido o limite, só abre OS nova no mês seguinte ou assinando o Pro. O resto do sistema continua funcionando.',
    ],
    related: ['fotos-da-os', 'comprovante-qr', 'portal-do-cliente'],
    keywords: ['nova os', 'abrir', 'cadastrar', 'entrada', 'checklist', 'acessorios', 'balcao', 'atendimento'],
  },
  {
    slug: 'fotos-da-os',
    category: 'os',
    title: 'Fotos do aparelho',
    summary: 'Registre o estado do aparelho na entrada, no diagnóstico e na saída.',
    roles: ALL_ROLES,
    media: [{ type: 'image', file: 'fotos.webp', frame: 'card', alt: 'Quadro de fotos da OS com botões para tirar foto e escolher da galeria' }],
    steps: [
      { title: 'Tire ou escolha a foto', text: 'Na OS, no quadro **Fotos**, use **Tirar foto** (no celular, abre a câmera) ou **Escolher da galeria**. Dá para enviar várias de uma vez.' },
      { title: 'Diga o que a foto mostra', text: 'Antes de enviar, escolha o que ela mostra (frente, traseira, tela, dano existente…) e o momento: entrada, diagnóstico ou saída.' },
      { title: 'Escolha o que o cliente vê', text: 'Cada foto tem o botão **No portal** / **Oculta**. As fotos no portal aparecem para o cliente, se essa opção estiver ligada em **Configurações**.' },
    ],
    tips: [
      'As fotos ficam privadas: só a equipe e, se você deixar, o próprio cliente conseguem ver.',
      'Fotografar os danos que já existiam na entrada evita discussão na hora da entrega.',
      'Só proprietário e administrador excluem fotos.',
      'Cada arquivo pode ter até 25 MB. O sistema reduz o tamanho antes de enviar.',
    ],
    related: ['abrir-os', 'portal-do-cliente'],
    keywords: ['foto', 'camera', 'imagem', 'galeria', 'dano', 'evidencia'],
  },
  {
    slug: 'diagnostico-e-status',
    category: 'os',
    title: 'Diagnóstico e andamento do conserto',
    summary: 'Registrar diagnóstico e solução, avançar o status e cancelar quando for preciso.',
    roles: ALL_ROLES,
    media: [{ type: 'image', file: 'os-detalhe.webp', frame: 'desktop', alt: 'Página da OS com diagnóstico, status e linha do tempo' }],
    steps: [
      { title: 'Inicie o diagnóstico', text: 'No quadro **Status**, escolha **Iniciar diagnóstico** em **Próximo passo** e clique em **Atualizar status**.' },
      { title: 'Escreva o diagnóstico', text: 'Em **Diagnóstico e solução**, descreva o que encontrou e clique em **Salvar**. O diagnóstico aparece no orçamento enviado ao cliente.' },
      { title: 'Siga o fluxo', text: 'Com o orçamento aprovado: **Iniciar manutenção**, **Aguardar peça** (se precisar) e **Concluir reparo**. Antes de concluir, preencha a **Solução aplicada**.' },
      { title: 'Reparo inviável', text: 'Durante o diagnóstico, escolha **Reparo inviável: liberar para devolução**. A OS vai para Pronto e o cliente retira sem conserto.' },
    ],
    tips: [
      'Diagnóstico e solução são preenchidos por técnicos, administrador e proprietário.',
      'A **Senha de desbloqueio** só aparece para técnicos e é apagada sozinha na entrega ou no cancelamento.',
      'Cancelar uma OS é só para proprietário e administrador, sempre com motivo. Orçamentos em aberto são cancelados junto.',
      'Precisa refazer algo depois de pronto? Um técnico pode usar **Reabrir reparo**, com uma nota explicando.',
    ],
    related: ['como-a-os-anda', 'montar-orcamento', 'entrega-e-garantia'],
    keywords: ['diagnostico', 'solucao', 'status', 'manutencao', 'peca', 'cancelar', 'reabrir', 'senha', 'tecnico'],
  },
  {
    slug: 'montar-orcamento',
    category: 'os',
    title: 'Montar e enviar o orçamento',
    summary: 'Peças e serviços, descontos, garantia e envio para o cliente aprovar pelo celular.',
    roles: TECH_ROLES,
    media: [{ type: 'image', file: 'orcamento.webp', frame: 'desktop', alt: 'Montagem do orçamento com itens, condições e envio ao cliente' }],
    steps: [
      { title: 'Abra o orçamento', text: 'Na OS, clique em **Orçamento** e depois em **Montar orçamento**.' },
      { title: 'Adicione os itens', text: 'Para cada peça ou serviço: tipo, descrição, quantidade, valor e desconto. Clique em **Adicionar**. Os totais são calculados sozinhos.' },
      { title: 'Ajuste as condições', text: 'Desconto no total, acréscimo, garantia em dias, condições de pagamento e observações. Clique em **Salvar condições**. As **Observações internas** nunca vão para o cliente.' },
      { title: 'Confira a pré-visualização', text: 'Logo abaixo aparece o documento exatamente como o cliente vai ver.' },
      { title: 'Envie', text: 'Em **Enviar ao cliente**, informe o prazo do conserto (em dias após a aprovação) e a validade da proposta, e clique em **Enviar orçamento**. A OS vai para Aguardando aprovação.' },
      { title: 'Mande o link', text: 'Use **Enviar no WhatsApp**: a mensagem já vai com o valor, o link e o código de acesso do cliente.' },
    ],
    tips: [
      'Depois de enviado, o orçamento fica congelado. Para mudar, use **Nova versão**: a versão anterior deixa de valer.',
      'Se o diagnóstico estiver vazio, o sistema avisa. Preencha na OS para ele sair no orçamento.',
      'Dá para imprimir pelo botão **Imprimir orçamento**.',
    ],
    related: ['aprovacao-do-cliente', 'diagnostico-e-status'],
    keywords: ['orcamento', 'pecas', 'servicos', 'desconto', 'garantia', 'enviar', 'versao', 'preco'],
  },
  {
    slug: 'aprovacao-do-cliente',
    category: 'os',
    title: 'Aprovação do orçamento',
    summary: 'O cliente aprova pelo celular. Se ele decidir no balcão ou por telefone, você registra.',
    roles: ALL_ROLES,
    media: [{ type: 'video', file: 'videos/aprovacao.mp4', poster: 'videos/aprovacao.webp', frame: 'phone', caption: 'O cliente entra com o telefone e o código, confere o orçamento e aprova.' }],
    steps: [
      { title: 'Pelo celular do cliente', text: 'Ele abre o link, entra com o telefone e o código, vê peças, serviços, prazo e garantia, e toca em **Aprovar orçamento** ou **Recusar orçamento**.' },
      { title: 'O status muda sozinho', text: 'Na aprovação, a OS vai para **Aprovado** e o técnico já pode iniciar a manutenção. Fica registrado quando e por onde o cliente aprovou.' },
      { title: 'Decidiu no balcão ou por telefone?', text: 'Abra o orçamento enviado e use **Registrar decisão do cliente**: escolha se aprovou ou recusou e como decidiu. Na recusa, o motivo é obrigatório.' },
      { title: 'Se o cliente recusar', text: 'A OS vai para **Orçamento recusado**. Você pode **Devolver sem reparo** ou, se existir uma versão aprovada antes, seguir com ela. Se cobrar taxa de diagnóstico, registre o recebimento na OS.' },
    ],
    tips: [
      'Orçamento vencido não pode mais ser aprovado: crie uma nova versão e envie de novo.',
      'Os motivos de recusa aparecem em **Relatórios** e ajudam a ajustar preços.',
    ],
    related: ['montar-orcamento', 'portal-do-cliente', 'registrar-pagamentos'],
    keywords: ['aprovar', 'aprovacao', 'recusa', 'recusado', 'balcao', 'telefone', 'whatsapp', 'vencido', 'decisao'],
  },
  {
    slug: 'entrega-e-garantia',
    category: 'os',
    title: 'Entrega e certificado de garantia',
    summary: 'Receber, registrar a entrega e imprimir a garantia em poucos cliques.',
    roles: ALL_ROLES,
    media: [
      { type: 'video', file: 'videos/entrega.mp4', poster: 'videos/entrega.webp', frame: 'desktop', caption: 'Registrar a entrega abre o certificado de garantia pronto para imprimir.' },
      { type: 'image', file: 'certificado.webp', frame: 'doc', alt: 'Certificado de garantia de 90 dias', caption: 'O certificado traz o prazo, o serviço feito e as peças trocadas.' },
    ],
    steps: [
      { title: 'Confira o pagamento', text: 'Com a OS em **Pronto para retirada**, o quadro **Pagamento** mostra o aprovado, o recebido e o que está em aberto. Se faltar algo, aparece o aviso **Saldo em aberto**.' },
      { title: 'Registre o pagamento', text: 'Clique em **Registrar pagamento ou compra**. O valor em aberto já vem preenchido. Escolha a forma (PIX, dinheiro, cartão…) e clique em **Registrar**.' },
      { title: 'Registre a entrega', text: 'No quadro **Status**, escolha **Registrar entrega** e clique em **Atualizar status**.' },
      { title: 'Imprima a garantia', text: 'O certificado de garantia abre pronto para imprimir, com o prazo contando a partir de hoje. Se o aparelho saiu sem conserto, sai um termo de retirada.' },
    ],
    tips: [
      'O prazo da garantia vem do orçamento aprovado.',
      'O cliente também vê e salva o certificado pelo portal.',
      'Para imprimir de novo depois, abra a OS e clique em **Certificado de garantia** (no plano Grátis, **Comprovante de garantia**).',
      'No plano Grátis a garantia sai em um comprovante simples, sem logo e sem a lista de peças e serviços. O certificado completo é do Pro.',
    ],
    related: ['registrar-pagamentos', 'portal-do-cliente', 'configurar-assistencia'],
    keywords: ['entrega', 'retirada', 'garantia', 'certificado', 'termo', 'pronto', 'saldo'],
  },

  // ---------------------------------------------------------------- Clientes e portal
  {
    slug: 'comprovante-qr',
    category: 'cliente',
    title: 'Comprovante de entrada com QR code',
    summary: 'O papel que o cliente leva: dados da OS, seus termos e o QR code para acompanhar.',
    roles: ALL_ROLES,
    media: [{ type: 'image', file: 'comprovante.webp', frame: 'doc', alt: 'Comprovante de entrada com QR code e código de acesso' }],
    steps: [
      { title: 'Imprima', text: 'Na OS, clique em **Comprovante** (ou **Comprovante com QR code**, no quadro de acompanhamento) e depois em **Imprimir comprovante**.' },
      { title: 'O que sai nele', text: 'Cliente, aparelho, problema relatado, acessórios, condição de entrada, previsão, o QR code, o código de acesso e os seus termos.' },
      { title: 'Assinaturas', text: 'No fim há espaço para a assinatura do cliente e da assistência.' },
    ],
    tips: [
      'Os termos do comprovante e a taxa de diagnóstico são definidos em **Configurações**.',
      'Perdeu o comprovante ou desconfia que outra pessoa tem o código? Use **Gerar novo código** na OS. O código antigo deixa de valer para novos acessos.',
    ],
    related: ['portal-do-cliente', 'abrir-os'],
    keywords: ['comprovante', 'qr code', 'imprimir', 'codigo de acesso', 'termos', 'assinatura'],
  },
  {
    slug: 'portal-do-cliente',
    category: 'cliente',
    title: 'Portal do cliente: o que ele vê',
    summary: 'Seu cliente acompanha o conserto pelo celular, sem precisar ligar para a loja.',
    roles: ALL_ROLES,
    media: [
      { type: 'image', file: 'portal-entrar.webp', frame: 'phone', alt: 'Tela de entrada do portal com telefone e código', caption: 'O cliente entra com o telefone e o código.' },
      { type: 'image', file: 'portal-acompanhamento.webp', frame: 'phone', alt: 'Acompanhamento do conserto no celular', caption: 'E acompanha cada etapa do conserto.' },
    ],
    steps: [
      { title: 'Como ele entra', text: 'Pelo link ou pelo QR code do comprovante, com o telefone cadastrado e o código de acesso da OS.' },
      { title: 'O que ele acompanha', text: 'As etapas (recebido, em análise, orçamento, conserto, pronto, entregue), as datas, o problema relatado, as fotos liberadas e o histórico com as suas notas.' },
      { title: 'O que ele pode fazer', text: 'Aprovar ou recusar o orçamento e, depois da entrega, ver e salvar o certificado de garantia.' },
      { title: 'Veja como ele vê', text: 'Na OS, use **Ver como cliente** para abrir o portal do jeito que o cliente enxerga.' },
    ],
    tips: [
      'Com o mesmo telefone, o cliente vê todos os aparelhos dele na sua assistência.',
      'O acesso vale enquanto a OS está aberta, até 90 dias depois de fechada e durante a garantia.',
      'Depois de 5 tentativas erradas, o portal pede para esperar 15 minutos.',
      'Para cortar o acesso de um cliente, use **Encerrar acessos ao portal** na ficha dele.',
    ],
    related: ['comprovante-qr', 'aprovacao-do-cliente', 'fotos-da-os'],
    keywords: ['portal', 'cliente', 'acompanhamento', 'link', 'codigo', 'telefone', 'acesso'],
  },
  {
    slug: 'clientes-e-equipamentos',
    category: 'cliente',
    title: 'Clientes e equipamentos',
    summary: 'Cadastro, histórico de cada aparelho e privacidade dos dados (LGPD).',
    roles: ALL_ROLES,
    screen: { href: '/painel/clientes', label: 'Abrir Clientes' },
    media: [{ type: 'image', file: 'cliente.webp', frame: 'desktop', alt: 'Ficha do cliente com OS e equipamentos' }],
    steps: [
      { title: 'Encontre rápido', text: 'Em **Clientes**, busque por nome, telefone ou CPF/CNPJ. Em **Equipamentos**, por marca, modelo, número de série ou IMEI.' },
      { title: 'Ficha do cliente', text: 'Mostra contato, as OS e os equipamentos dele. Dali você abre uma **Nova OS** com o cliente já preenchido.' },
      { title: 'Histórico do aparelho', text: 'Na ficha do equipamento aparecem todas as passagens dele pela assistência. Ajuda muito em retorno e garantia.' },
      { title: 'Corrija os dados', text: 'Use **Editar dados do cliente** na ficha. O equipamento é editado na ficha dele.' },
    ],
    tips: [
      'O telefone é único por cliente na assistência: é com ele que o cliente entra no portal.',
      'Proprietário e administrador podem excluir um cliente sem OS ou anonimizar um cliente com histórico (LGPD). Não dá para desfazer.',
    ],
    related: ['abrir-os', 'portal-do-cliente'],
    keywords: ['cliente', 'cadastro', 'equipamento', 'aparelho', 'imei', 'serie', 'historico', 'lgpd', 'excluir', 'anonimizar'],
  },

  // ---------------------------------------------------------------- Financeiro
  {
    slug: 'registrar-pagamentos',
    category: 'financeiro',
    title: 'Registrar pagamentos e compras',
    summary: 'Recebimentos, taxas e compras de peça, sempre ligados à OS certa.',
    roles: ALL_ROLES,
    media: [{ type: 'image', file: 'pagamento.webp', frame: 'card', alt: 'Quadro de pagamento da OS com o formulário de lançamento' }],
    steps: [
      { title: 'Dentro da OS', text: 'No quadro **Pagamento**, clique em **Registrar pagamento ou compra**. A OS já vem preenchida, e o valor em aberto também.' },
      { title: 'Pelo caixa', text: 'Em **Caixa** (ou **Meus lançamentos**), use o quadro **Novo lançamento**. Em recebimentos, informe o número da OS (ex.: 123).' },
      { title: 'Preencha', text: 'Categoria, valor, forma de pagamento, data e descrição. Em compras de peça, escolha o fornecedor e a quantidade.' },
      { title: 'Errou?', text: 'Proprietário e administrador podem **Anular** um lançamento, com motivo. Ele continua na lista, riscado, para o histórico.' },
    ],
    table: {
      title: 'Quem lança o quê',
      columns: ['Função', 'O que pode lançar'],
      rows: [
        [`${ROLES.owner} e ${ROLES.admin.toLowerCase()}`, 'Todas as entradas e saídas, inclusive despesas.'],
        [ROLES.technician, 'Recebimento de OS, taxa de diagnóstico e compra de peça.'],
        [ROLES.attendant, 'Recebimento de OS e taxa de diagnóstico.'],
      ],
    },
    tips: [
      'Recebimento de OS e taxa de diagnóstico sempre precisam de uma OS.',
      'Não dá para lançar com data futura.',
      'Registrar a compra de peça na OS faz o lucro dela aparecer certo em **Relatórios**.',
    ],
    related: ['entrega-e-garantia', 'caixa', 'fornecedores'],
    keywords: ['pagamento', 'recebimento', 'pix', 'dinheiro', 'cartao', 'compra', 'peca', 'lancamento', 'anular', 'estorno'],
  },
  {
    slug: 'caixa',
    category: 'financeiro',
    title: 'Caixa e contas a receber',
    summary: 'Entradas, saídas, saldo do período e quanto ainda falta receber.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/caixa', label: 'Abrir Caixa' },
    media: [{ type: 'image', file: 'caixa.webp', frame: 'desktop', alt: 'Tela do caixa com totais e lançamentos' }],
    steps: [
      { title: 'Escolha o período', text: 'Use os atalhos **Hoje**, **7 dias** e **Este mês**, ou escolha as datas e clique em **Aplicar**.' },
      { title: 'Leia os totais', text: '**Entradas** e **Saídas** são o dinheiro que de fato entrou e saiu. **Previsto** soma os orçamentos aguardando o cliente. **A receber** é o que foi aprovado e ainda não foi pago.' },
      { title: 'Cobre o que está em aberto', text: 'O quadro **A receber por OS** lista cada OS com saldo, do maior valor para o menor. Clique para abrir a OS.' },
      { title: 'Lance as despesas', text: 'Aluguel, luz e outras saídas vão em **Novo lançamento**, como **Despesa operacional**.' },
    ],
    tips: [
      'Técnicos e atendentes não veem o caixa. Para eles a tela se chama **Meus lançamentos** e mostra só o que cada um registrou.',
    ],
    related: ['registrar-pagamentos', 'relatorios', 'dashboard'],
    keywords: ['caixa', 'saldo', 'entradas', 'saidas', 'a receber', 'previsto', 'despesa', 'fluxo de caixa'],
  },
  {
    slug: 'dashboard',
    category: 'financeiro',
    title: 'Dashboard',
    summary: 'O resumo do dia: OS abertas, atrasadas, aguardando cliente e o movimento recente.',
    roles: ALL_ROLES,
    screen: { href: '/painel', label: 'Abrir Dashboard' },
    media: [{ type: 'image', file: 'dashboard.webp', frame: 'desktop', alt: 'Dashboard com indicadores de OS e financeiro' }],
    steps: [
      { title: 'Indicadores de OS', text: '**OS abertas** e **Atrasadas** mostram a situação agora. **Entraram**, **Concluídas** e **Entregues** contam o período escolhido no topo.' },
      { title: 'Aguardando cliente', text: 'São os orçamentos enviados sem resposta. Vale lembrar o cliente pelo WhatsApp.' },
      { title: 'Financeiro do período', text: 'Para proprietário e administrador: entradas, saídas, faturamento, ticket médio, taxa de aprovação de orçamentos e o gráfico de fluxo de caixa.' },
      { title: 'OS por status e movimentação recente', text: 'Clique em uma OS para abrir direto.' },
    ],
    related: ['caixa', 'relatorios', 'como-a-os-anda'],
    keywords: ['dashboard', 'inicio', 'indicadores', 'resumo', 'ticket medio', 'faturamento', 'aprovacao'],
  },
  {
    slug: 'relatorios',
    category: 'financeiro',
    title: 'Relatórios',
    summary: 'Para onde vai o dinheiro, quem entrega mais e quanto sobra em cada OS.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/relatorios', label: 'Abrir Relatórios' },
    media: [{ type: 'image', file: 'relatorios.webp', frame: 'desktop', alt: 'Relatórios com recebimentos, saídas e desempenho' }],
    steps: [
      { title: 'Escolha o período', text: 'Use os atalhos ou escolha as datas e clique em **Aplicar**.' },
      { title: 'Recebimentos e saídas', text: 'Recebimentos por forma de pagamento e saídas por categoria.' },
      { title: 'Equipe e equipamentos', text: 'OS entregues por técnico e entradas por categoria de equipamento.' },
      { title: 'Lucro estimado por OS', text: 'Para cada OS entregue: o que foi recebido menos as peças compradas para ela.' },
      { title: 'Orçamentos recusados', text: 'Os motivos informados pelos clientes no período.' },
    ],
    tips: ['O lucro só fica certo quando as compras de peça são lançadas ligadas à OS.'],
    related: ['caixa', 'registrar-pagamentos', 'fornecedores'],
    keywords: ['relatorio', 'lucro', 'tecnico', 'desempenho', 'recusas', 'forma de pagamento'],
  },
  {
    slug: 'fornecedores',
    category: 'financeiro',
    title: 'Fornecedores',
    summary: 'Cadastre de quem você compra peças para lançar as compras certinho.',
    roles: TECH_ROLES,
    screen: { href: '/painel/fornecedores', label: 'Abrir Fornecedores' },
    steps: [
      { title: 'Cadastre', text: 'Em **Fornecedores**, preencha nome, telefone, CNPJ/CPF e observações e clique em **Cadastrar**.' },
      { title: 'Use nas compras', text: 'Ao lançar uma **Compra de peça**, escolha o fornecedor e a quantidade.' },
      { title: 'Desative quem não usa mais', text: 'Em **Editar**, mude a situação para **Inativo**. Ele sai das listas de escolha.' },
    ],
    related: ['registrar-pagamentos', 'relatorios'],
    keywords: ['fornecedor', 'compra', 'peca', 'distribuidor'],
  },

  // ---------------------------------------------------------------- Equipe, plano e conta
  {
    slug: 'convidar-equipe',
    category: 'conta',
    title: 'Convidar a equipe e definir funções',
    summary: 'Cada pessoa entra com o próprio e-mail e vê só o que a função permite.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/usuarios', label: 'Abrir Equipe' },
    media: [{ type: 'image', file: 'equipe.webp', frame: 'desktop', alt: 'Tela de Equipe com membros e convite' }],
    steps: [
      { title: 'Gere o convite', text: 'Em **Equipe**, no quadro **Convidar pessoa**, informe o e-mail e a função e clique em **Gerar convite**.' },
      { title: 'Envie o link', text: 'Copie o link ou envie pelo botão **WhatsApp**. O link aparece só uma vez e vale por 7 dias.' },
      { title: 'A pessoa aceita', text: 'Ela abre o link, cria a conta com o mesmo e-mail do convite (ou entra, se já tiver conta) e clica em **Aceitar convite**.' },
      { title: 'Ajuste quando precisar', text: 'Na lista de membros dá para trocar a função ou desativar o acesso de alguém. Convites não usados podem ser cancelados.' },
    ],
    table: {
      title: 'O que cada função pode fazer',
      columns: ['Função', 'O que pode fazer'],
      rows: [
        [ROLES.owner, 'Tudo, inclusive equipe, configurações e financeiro.'],
        [ROLES.admin, 'Como o proprietário, exceto convidar administradores e mexer em proprietários.'],
        [ROLES.technician, 'OS, diagnóstico, orçamentos, fotos e compra de peças. Não vê o caixa.'],
        [ROLES.attendant, 'Clientes, abertura e entrega de OS, recebimentos e decisões do cliente no balcão.'],
      ],
    },
    tips: ['Desativar alguém não apaga o que a pessoa fez: o histórico continua nas OS e no caixa.'],
    related: ['comece-por-aqui', 'minha-conta'],
    keywords: ['equipe', 'usuario', 'convite', 'funcionario', 'tecnico', 'atendente', 'administrador', 'permissao', 'funcao'],
  },
  {
    slug: 'meu-plano',
    category: 'conta',
    title: 'Meu plano: Grátis e Pro',
    summary: 'Pro grátis nos primeiros 14 dias, plano Grátis depois e assinatura do Pro pelo Mercado Pago.',
    roles: MANAGER_ROLES,
    screen: { href: '/painel/plano', label: 'Abrir Meu plano' },
    steps: [
      { title: 'Pro grátis nos 14 primeiros dias', text: 'Toda assistência nova começa com o Pro completo, sem cartão. Os dias que faltam aparecem no menu. Depois, a conta passa sozinha para o plano Grátis, sem perder nada.' },
      { title: 'Plano Grátis', text: 'Até 30 OS por mês (renova no dia 1º), garantia em comprovante simples e sem convidar pessoas para a equipe. O menu mostra quantas OS você já usou no mês.' },
      { title: 'Assine o Pro', text: 'Em **Meu plano**, escolha mensal ou anual, confira o e-mail da sua conta no Mercado Pago e clique em **Assinar com Mercado Pago**. Se assinar durante o Pro grátis, a primeira cobrança só acontece no fim dele.' },
      { title: 'Volte para o TecnoFix', text: 'No fim do pagamento, use o botão do Mercado Pago para voltar ao site do vendedor. Se a assinatura ainda não aparecer, clique em **Verificar pagamento**.' },
      { title: 'Cancelar', text: 'Em **Cancelar a renovação**. O Pro continua até o fim do período pago; depois, a conta volta ao plano Grátis.' },
    ],
    tips: [
      'Pagamento atrasado tem 7 dias de tolerância no Pro; depois, a conta volta ao plano Grátis. Nada é apagado: você continua vendo, imprimindo, entregando e concluindo o que já existe.',
      'O portal dos seus clientes continua funcionando mesmo assim.',
    ],
    related: ['comece-por-aqui'],
    keywords: ['plano', 'assinatura', 'pagamento', 'mercado pago', 'teste gratis', 'gratis', 'pro', 'limite', 'cancelar', 'cobranca'],
  },
  {
    slug: 'minha-conta',
    category: 'conta',
    title: 'Minha conta e várias assistências',
    summary: 'Seus dados, troca de senha e como alternar entre assistências.',
    roles: ALL_ROLES,
    screen: { href: '/painel/minha-conta', label: 'Abrir Minha conta' },
    steps: [
      { title: 'Seus dados', text: 'Clique no seu nome, no rodapé do menu, para abrir **Minha conta** e mudar nome e telefone.' },
      { title: 'Trocar a senha', text: 'Em **Trocar senha**, com no mínimo 8 caracteres. Esqueceu a senha? Na tela de entrar, use **Esqueci minha senha**.' },
      { title: 'Mais de uma assistência', text: 'Se você faz parte de outra assistência, use **Trocar assistência**, logo abaixo do nome da assistência no menu. Para abrir outra, use **Cadastrar nova** em **Minha conta**.' },
    ],
    related: ['convidar-equipe'],
    keywords: ['senha', 'conta', 'perfil', 'nome', 'trocar assistencia', 'esqueci'],
  },
];

export const FAQ = [
  { q: 'O cliente diz que o código de acesso não funciona.', a: 'Confira se ele está usando o mesmo telefone cadastrado na OS. Depois de 5 tentativas erradas, o portal pede 15 minutos de espera. Se precisar, use **Gerar novo código** na OS e envie de novo.', roles: ALL_ROLES },
  { q: 'Preciso mudar um orçamento que já enviei.', a: 'Abra o orçamento e clique em **Nova versão**. A versão enviada deixa de valer e você envia a nova.', roles: TECH_ROLES },
  { q: 'Registrei um pagamento errado.', a: 'O proprietário ou o administrador anula o lançamento no **Caixa**, com motivo. Depois é só registrar de novo.', roles: ALL_ROLES },
  { q: 'Por que não consigo abrir uma OS nova?', a: 'No plano Grátis, o limite é de 30 OS por mês. Ele renova no dia 1º, ou o proprietário assina o Pro em **Meu plano** para abrir OS sem limite.', roles: ALL_ROLES },
  { q: 'Como cancelo uma OS?', a: 'Proprietário ou administrador cancela no quadro **Status** da OS, em **Cancelar OS**, informando o motivo.', roles: ALL_ROLES },
  { q: 'Esqueci minha senha.', a: 'Na tela de entrar, clique em **Esqueci minha senha** e siga o link que chega por e-mail. Se não chegar, olhe a caixa de spam.', roles: ALL_ROLES },
  { q: 'O técnico não vê o caixa. É normal?', a: 'Sim. Técnicos e atendentes veem só os lançamentos que eles mesmos registraram, em **Meus lançamentos**.', roles: MANAGER_ROLES },
  { q: 'O cliente perdeu o comprovante.', a: 'Ele pode entrar no portal só com o telefone e o código. Se o código também se perdeu, envie de novo pelo WhatsApp na OS, ou gere um novo código.', roles: ALL_ROLES },
];

// ---------------------------------------------------------------- consultas

export function guidesForRole(role) {
  return GUIDES.filter((g) => g.roles.includes(role));
}

export function faqForRole(role) {
  return FAQ.filter((f) => f.roles.includes(role));
}

export function getGuide(slug, role) {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g || !g.roles.includes(role)) return null;
  return g;
}

/** Texto pesquisável de um guia: título, resumo, passos, dicas e palavras-chave. */
export function searchableText(g) {
  return normalizeSearch([
    g.title, g.summary, ...(g.keywords || []),
    ...(g.steps || []).flatMap((st) => [st.title, st.text]),
    ...(g.tips || []),
  ].join(' ').replace(/\*\*/g, ''));
}
