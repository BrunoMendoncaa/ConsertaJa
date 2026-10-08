// Formatação dos dados da assistência usados nos documentos impressos
// (comprovante de entrada, certificado de garantia).

export function assistanceAddressLine(address) {
  const a = address || {};
  return [
    a.rua && `${a.rua}${a.numero ? `, ${a.numero}` : ''}`,
    a.complemento,
    a.bairro,
    a.cidade && `${a.cidade}${a.uf ? `/${a.uf}` : ''}`,
    a.cep,
  ].filter(Boolean).join(' · ');
}

export function assistanceContactLine(assistance) {
  return [
    assistance.phone && `Tel. ${assistance.phone}`,
    assistance.whatsapp && `WhatsApp ${assistance.whatsapp}`,
    assistance.email,
  ].filter(Boolean).join(' · ');
}
