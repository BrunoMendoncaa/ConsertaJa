/** Monta um "snapshot" provisório para pré-visualizar um rascunho. */
export function buildDraftDoc({ assistance, order, version, items }) {
  return {
    version: version.version,
    issued_at: version.created_at,
    valid_until: null,
    assistance: {
      name: assistance.name, legal_name: assistance.legal_name, document: assistance.document,
      phone: assistance.phone, whatsapp: assistance.whatsapp, email: assistance.email,
      address: assistance.address, brand_color: assistance.brand_color, warranty_policy: assistance.warranty_policy,
    },
    customer: { name: order.customer?.name, phone: order.customer?.phone },
    equipment: {
      category: order.equipment?.category?.name, brand: order.equipment?.brand, model: order.equipment?.model,
      serial_number: order.equipment?.serial_number, imei: order.equipment?.imei, color: order.equipment?.color,
    },
    service_order: {
      code: order.code, received_at: order.received_at, reported_issue: order.reported_issue, diagnosis: order.diagnosis,
    },
    items: items.map((i) => ({
      kind: i.kind, description: i.description, quantity: i.quantity, unit_price: i.unit_price,
      discount_amount: i.discount_amount, subtotal: i.subtotal,
    })),
    totals: {
      items_subtotal: version.items_subtotal, discount_amount: version.discount_amount,
      surcharge_amount: version.surcharge_amount, total: version.total,
    },
    terms: {
      estimated_days: version.estimated_days, warranty_days: version.warranty_days, payment_terms: version.payment_terms,
      customer_notes: version.customer_notes, technical_notes: version.technical_notes,
    },
  };
}
