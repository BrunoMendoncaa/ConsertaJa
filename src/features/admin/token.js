// Sessão da área admin: cookie assinado (HMAC-SHA256), sem guardar nada no banco.
// A chave junta ADMIN_SESSION_SECRET e ADMIN_PASSWORD_HASH: trocar a senha derruba as sessões abertas.
import crypto from 'node:crypto';

export const SESSION_HOURS = 12;

/** Lê as variáveis de ambiente. Sem as três, a área admin fica desligada. */
export function readAdminConfig(env = process.env) {
  const username = String(env.ADMIN_USERNAME || '').trim().toLowerCase();
  const hash = String(env.ADMIN_PASSWORD_HASH || '').trim();
  const secret = String(env.ADMIN_SESSION_SECRET || '').trim();
  if (!username || !hash.startsWith('scrypt:') || secret.length < 32) return null;
  return { username, hash, secret };
}

function key(cfg) {
  return crypto.createHash('sha256').update(`${cfg.secret}|${cfg.hash}`).digest();
}

/**
 * Cookie da sessão. Sem `account`: sessão da conta master (variáveis ADMIN_*).
 * Com `account` ({ username, session_version }): sessão de uma conta do banco; a versão
 * vai junto para a sessão cair quando a senha for trocada ou a conta desativada.
 */
export function signSession(cfg, now = Date.now(), account = null) {
  const data = { u: account ? account.username : cfg.username, exp: now + SESSION_HOURS * 3600 * 1000 };
  if (account) data.sv = account.session_version;
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', key(cfg)).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Confere assinatura e validade do cookie. Devolve
 * { username, expiresAt, master: true } para a master ou
 * { username, expiresAt, master: false, sv } para uma conta do banco (que ainda precisa
 * ser conferida no banco: ativa e com a mesma versão de sessão). Senão, null.
 */
export function verifySession(cfg, token, now = Date.now()) {
  if (!cfg || typeof token !== 'string') return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac('sha256', key(cfg)).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof data?.u !== 'string' || typeof data.exp !== 'number' || data.exp <= now) return null;
  if (data.u === cfg.username && data.sv === undefined) return { username: data.u, expiresAt: data.exp, master: true };
  if (data.u !== cfg.username && Number.isInteger(data.sv) && data.sv >= 1) {
    return { username: data.u, expiresAt: data.exp, master: false, sv: data.sv };
  }
  return null;
}
