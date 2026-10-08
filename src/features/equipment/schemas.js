import { z, optionalText, uuid } from '@/lib/forms';

export const equipmentSchema = z.object({
  category_id: uuid('Escolha a categoria.'),
  brand: optionalText(80),
  model: optionalText(120),
  serial_number: optionalText(80),
  imei: z.string().trim().optional().nullable()
    .transform((v) => (v ? v.replace(/\D/g, '') : null))
    .refine((v) => v === null || /^\d{15}$/.test(v), 'O IMEI deve ter 15 dígitos.'),
  color: optionalText(40),
  description: optionalText(500),
  notes: optionalText(2000),
});
