/** Endereço do portal a partir do nome: sem acento, minúsculas, números e hífen (até 50). */
export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
