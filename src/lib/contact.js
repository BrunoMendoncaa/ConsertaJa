// Contato do TecnoFix (aparece no site). Número público, não é segredo.
export const WHATSAPP_NUMBER = '5511993020625';
export const WHATSAPP_LABEL = '(11) 99302-0625';

/** Link do WhatsApp com a mensagem já escrita (wa.me abre o app no celular e o WhatsApp Web no computador). */
export function whatsappLink(text = 'Olá! Vi o TecnoFix no site e queria tirar uma dúvida.') {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
