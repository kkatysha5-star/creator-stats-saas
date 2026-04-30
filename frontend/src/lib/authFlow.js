import { api } from './api.js';

function withActiveWorkspaceFirst(data, workspaceId) {
  if (!data?.workspaces?.length || !workspaceId) return data;
  const index = data.workspaces.findIndex(w => String(w.id) === String(workspaceId));
  if (index <= 0) return data;
  const workspaces = [...data.workspaces];
  const [active] = workspaces.splice(index, 1);
  return { ...data, workspaces: [active, ...workspaces] };
}

export async function finishAuth(setAuth, navigate, inviteToken, preferredWorkspaceId = null) {
  let joinedWorkspaceId = null;
  if (inviteToken) {
    const joined = await api.joinWorkspace(inviteToken);
    joinedWorkspaceId = joined?.workspace_id;
    localStorage.removeItem('pendingInviteToken');
  }

  const data = await api.getMe();
  const targetWorkspaceId = joinedWorkspaceId || preferredWorkspaceId;
  const workspace = targetWorkspaceId
    ? data?.workspaces?.find(w => String(w.id) === String(targetWorkspaceId))
    : data?.workspaces?.[0];

  if (workspace) api.setWorkspace(workspace.id);
  setAuth(withActiveWorkspaceFirst(data, workspace?.id));

  if (!workspace) return navigate('/onboarding');
  if (workspace.role !== 'creator') return navigate('/');

  const myCreator = await api.getMyCreator().catch(() => ({ creator: null }));
  navigate(myCreator.creator ? '/' : '/creators/new');
}
