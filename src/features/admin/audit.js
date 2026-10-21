import 'server-only';
import { logError } from '@/lib/logger';
import { clientIp } from './session';

/** Registra uma ação da área admin (quem, o quê, em qual assistência). Falha aqui não derruba a ação. */
export async function audit(db, username, action, assistanceId, details = {}) {
  const { error } = await db.from('admin_audit_log').insert({
    admin_username: username, action, assistance_id: assistanceId, details, ip: await clientIp(),
  });
  if (error) logError('admin.audit', error, { action });
}
