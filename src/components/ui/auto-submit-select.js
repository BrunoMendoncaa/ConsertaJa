'use client';

import { Select } from './input';

/** Select que envia o formulário assim que muda (filtros no celular). */
export function AutoSubmitSelect(props) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
