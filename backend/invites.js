import { db } from './db.js';

export async function acceptInvite(token, user) {
  if (!token || !user) return null;

  const inviteResult = await db.execute({
    sql: 'SELECT * FROM invites WHERE token = ?',
    args: [token],
  });
  if (!inviteResult.rows.length) return null;

  const invite = inviteResult.rows[0];
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    const err = new Error('Ссылка-приглашение устарела');
    err.status = 410;
    throw err;
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    args: [invite.workspace_id, user.id],
  });

  if (!existing.rows.length) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, invite_id) VALUES (?, ?, ?, ?)',
      args: [invite.workspace_id, user.id, invite.role, invite.id],
    });
    await db.execute({
      sql: 'UPDATE invites SET use_count = use_count + 1 WHERE id = ?',
      args: [invite.id],
    });
  }

  await db.execute({
    sql: `UPDATE creators
          SET user_id = ?
          WHERE workspace_id = ? AND lower(email) = lower(?) AND (user_id IS NULL OR user_id = ?)`,
    args: [user.id, invite.workspace_id, user.email, user.id],
  }).catch(() => {});

  return invite;
}
