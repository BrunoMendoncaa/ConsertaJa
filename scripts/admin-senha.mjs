#!/usr/bin/env node
// Gera o usuário e a senha da área admin do TecnoFix (tecnofix.pro/admin).
// Rode no seu computador, na pasta do projeto:   npm run admin:senha
// A senha é digitada aqui, sem aparecer na tela, e sai já criptografada (scrypt).
// Cole as 3 linhas impressas em Vercel → Settings → Environment Variables (Production)
// e faça um novo deploy. Para testar localmente, cole também no .env.local.
import crypto from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const N = 32768, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize('NFC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024 });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export function newSessionSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

export function passwordProblem(password) {
  if (password.length < 12) return 'Use pelo menos 12 caracteres.';
  if (/^(.)\1+$/.test(password)) return 'Senha fraca demais.';
  return null;
}

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(question, (a) => resolve(a.trim()));
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => { if (s.includes(question)) write.call(rl, s); else write.call(rl, ''); };
    rl.question(question, (a) => { rl._writeToOutput = write; process.stdout.write('\n'); resolve(a); });
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  console.log('\nÁrea admin do TecnoFix — criar usuário e senha\n');
  let username = await ask(rl, 'Usuário (ex.: bruno): ');
  username = username.toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) { console.log('Use de 3 a 40 letras minúsculas, números, ponto, hífen ou _.'); process.exit(1); }
  const password = await ask(rl, 'Senha (mín. 12 caracteres, não aparece na tela): ', { hidden: true });
  const problem = passwordProblem(password);
  if (problem) { console.log(problem); process.exit(1); }
  const again = await ask(rl, 'Repita a senha: ', { hidden: true });
  rl.close();
  if (again !== password) { console.log('As senhas não conferem. Rode de novo.'); process.exit(1); }

  console.log('\nCole estas 3 variáveis na Vercel (Settings → Environment Variables → Production) e faça um novo deploy:\n');
  console.log(`ADMIN_USERNAME=${username}`);
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log(`ADMIN_SESSION_SECRET=${newSessionSecret()}`);
  console.log('\nDepois entre em https://tecnofix.pro/admin com o usuário e a senha que você digitou.');
  console.log('Para trocar a senha no futuro, rode este comando de novo e substitua as 3 variáveis (quem estiver logado sai).\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
