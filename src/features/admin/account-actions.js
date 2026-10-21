'use server';

// Acessos da área admin: só a conta master cria, altera e remove; cada conta troca a própria senha.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/logger';
import { adminConfig, actionSession, getAdminSession, ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS } from './session';
import { signSession } from './token';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { normalizePermissions, USERNAME_RE, homeFor } from './permissions';
import { audit } from './audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETUP_CODES = ['PGRST202', 'PGRST205', '42883', '42P01'];
const SETUP_MESSAGE = 'Aplique a migration 0017 (acessos da área admin) no Supabase antes de criar acessos.';

const text = (formData, name, max) => String(formData.get(name) || '').trim().slice(0, max);

function readAccountForm(formData) {
  return {
    fullName: text(formData, 'full_name', 80),
    permissions: normalizePermissions(formData.getAll('permissions')),
  };
}

async function loadAccount(db, id) {
  if (!UUID_RE.test(id)) return { account: null };
  const { data, error } = await db.from('admin_accounts')
    .select('id, username, full_name, permissions, active, session_version').eq('id', id).maybeSingle();
  if (error) throw error;
  return { account: data };
}

function failure(err, where) {
  if (SETUP_CODES.includes(err?.code)) return { ok: false, error: SETUP_MESSAGE };
  logError(where, err);
  return { ok: false, error: 'Não foi possível salvar agora. Tente de novo.' };
}

// ---------------------------------------------------------------- Criar
export async function createAdminAccount(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };

  const { fullName, permissions } = readAccountForm(formData);
  const username = text(formData, 'username', 60).toLowerCase();
  const password = String(formData.get('password') || '');
  const fieldErrors = {};
  if (fullName.length < 2) fieldErrors.full_name = 'Informe o nome.';
  if (!USERNAME_RE.test(username)) fieldErrors.username = 'De 3 a 40 letras minúsculas, números, ponto, hífen ou _.';
  else if (username === adminConfig()?.username) fieldErrors.username = 'Esse é o usuário da conta master.';
  const problem = passwordProblem(password);
  if (problem) fieldErrors.password = problem;
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Confira os campos destacados.', fieldErrors };

  const db = createAdminClient();
  const { data, error } = await db.from('admin_accounts').insert({
    username, full_name: fullName, password_hash: hashPassword(password), permissions,
    must_change_password: true, created_by: auth.session.username,
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Já existe um acesso com esse usuário.', fieldErrors: { username: 'Já existe.' } };
    return failure(error, 'admin.createAccount');
  }

  await audit(db, auth.session.username, 'admin_create', null, { target: username, permissions });
  revalidatePath('/admin/acessos');
  return { ok: true, message: `Acesso de ${fullName} criado. Passe o usuário e a senha para a pessoa: ela troca a senha no primeiro acesso.`, id: data.id };
}

// ---------------------------------------------------------------- Alterar nome, permissões e situação
export async function updateAdminAccount(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };

  const id = String(formData.get('id') || '');
  const { fullName, permissions } = readAccountForm(formData);
  const active = formData.get('active') === 'on';
  if (fullName.length < 2) return { ok: false, error: 'Informe o nome.', fieldErrors: { full_name: 'Informe o nome.' } };

  const db = createAdminClient();
  try {
    const { account } = await loadAccount(db, id);
    if (!account) return { ok: false, error: 'Acesso não encontrado.' };
    const patch = { full_name: fullName, permissions, active };
    // Desativar derruba as sessões abertas na hora.
    if (account.active && !active) patch.session_version = account.session_version + 1;
    const { error } = await db.from('admin_accounts').update(patch).eq('id', id);
    if (error) return failure(error, 'admin.updateAccount');

    const before = normalizePermissions(account.permissions);
    await audit(db, auth.session.username, 'admin_update', null, {
      target: account.username,
      added: permissions.filter((p) => !before.includes(p)),
      removed: before.filter((p) => !permissions.includes(p)),
      active: active === account.active ? undefined : active,
    });
  } catch (err) {
    return failure(err, 'admin.updateAccount');
  }
  revalidatePath('/admin/acessos', 'layout');
  return { ok: true, message: active ? 'Acesso salvo. As permissões valem a partir do próximo clique da pessoa.' : 'Acesso salvo e desativado. A pessoa saiu da área admin.' };
}

// ---------------------------------------------------------------- Redefinir senha
export async function resetAdminPassword(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };

  const id = String(formData.get('id') || '');
  const password = String(formData.get('password') || '');
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem, fieldErrors: { password: problem } };

  const db = createAdminClient();
  try {
    const { account } = await loadAccount(db, id);
    if (!account) return { ok: false, error: 'Acesso não encontrado.' };
    const { error } = await db.from('admin_accounts').update({
      password_hash: hashPassword(password), must_change_password: true,
      session_version: account.session_version + 1, password_changed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return failure(error, 'admin.resetPassword');
    await audit(db, auth.session.username, 'admin_password_reset', null, { target: account.username });
  } catch (err) {
    return failure(err, 'admin.resetPassword');
  }
  revalidatePath('/admin/acessos', 'layout');
  return { ok: true, message: 'Senha redefinida. A pessoa saiu da área admin e vai trocar a senha no próximo acesso.' };
}

// ---------------------------------------------------------------- Remover
export async function deleteAdminAccount(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };

  const id = String(formData.get('id') || '');
  const db = createAdminClient();
  try {
    const { account } = await loadAccount(db, id);
    if (!account) return { ok: false, error: 'Acesso não encontrado.' };
    const { error } = await db.from('admin_accounts').delete().eq('id', id);
    if (error) return failure(error, 'admin.deleteAccount');
    await audit(db, auth.session.username, 'admin_delete', null, { target: account.username });
  } catch (err) {
    return failure(err, 'admin.deleteAccount');
  }
  revalidatePath('/admin/acessos', 'layout');
  redirect('/admin/acessos');
}

// ---------------------------------------------------------------- Minha senha (contas do banco)
export async function changeOwnPassword(_prev, formData) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/entrar');
  if (session.master) return { ok: false, error: 'A senha da conta master fica nas variáveis da Vercel (npm run admin:senha).' };

  const current = String(formData.get('current_password') || '');
  const password = String(formData.get('password') || '');
  const again = String(formData.get('password_again') || '');
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem, fieldErrors: { password: problem } };
  if (again !== password) return { ok: false, error: 'As senhas novas não conferem.', fieldErrors: { password_again: 'Não confere.' } };
  if (current === password) return { ok: false, error: 'A senha nova precisa ser diferente da atual.', fieldErrors: { password: 'Igual à atual.' } };

  const db = createAdminClient();
  const { data: row, error } = await db.from('admin_accounts')
    .select('id, username, password_hash, session_version').eq('id', session.id).maybeSingle();
  if (error || !row) return failure(error, 'admin.changeOwnPassword');
  if (!verifyPassword(current, row.password_hash)) {
    return { ok: false, error: 'A senha atual não confere.', fieldErrors: { current_password: 'Não confere.' } };
  }
  const nextVersion = row.session_version + 1;
  const { error: upErr } = await db.from('admin_accounts').update({
    password_hash: hashPassword(password), must_change_password: false,
    session_version: nextVersion, password_changed_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (upErr) return failure(upErr, 'admin.changeOwnPassword');

  // Sessões em outros aparelhos caem; esta continua com a versão nova.
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, signSession(adminConfig(), Date.now(), { username: row.username, session_version: nextVersion }), ADMIN_COOKIE_OPTIONS);
  await audit(db, row.username, 'password_change', null, {});
  redirect(homeFor(session));
}
