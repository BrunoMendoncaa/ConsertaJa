// Senha da área admin: scrypt com sal aleatório. Formato guardado na variável
// ADMIN_PASSWORD_HASH: "scrypt:N:r:p:sal:hash" (base64url, sem "$" para não
// ser interpretado como variável em arquivos .env).
// O mesmo formato é gerado por scripts/admin-senha.mjs (npm run admin:senha).
import crypto from 'node:crypto';

const KEYLEN = 64;
const N = 32768, R = 8, P = 1;

/** Mesmo formato do comando npm run admin:senha (usado para as contas criadas na tela Acessos). */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password).normalize('NFC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024 });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

/** Regras da senha (as mesmas do comando). Devolve o problema ou null. */
export function passwordProblem(password) {
  const p = String(password ?? '');
  if (p.length < 12) return 'Use pelo menos 12 caracteres.';
  if (p.length > 200) return 'Use no máximo 200 caracteres.';
  if (/^(.)\1+$/.test(p)) return 'Senha fraca demais.';
  return null;
}

// Hash de um texto aleatório: conferido quando o usuário não existe, para o tempo de resposta
// ser o mesmo de um usuário existente com a senha errada.
let dummy;
export function dummyHash() {
  dummy ??= hashPassword(crypto.randomUUID());
  return dummy;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const N = Number(n), R = Number(r), P = Number(p);
  if (![N, R, P].every(Number.isInteger) || N < 16384 || N > 1048576) return false;
  let expected;
  try {
    expected = Buffer.from(hashB64, 'base64url');
    const salt = Buffer.from(saltB64, 'base64url');
    const got = crypto.scryptSync(password.normalize('NFC'), salt, expected.length || KEYLEN, {
      N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024,
    });
    return expected.length === got.length && crypto.timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

/** Compara textos sem vazar o tamanho/conteúdo pelo tempo de resposta. */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
