const BASE = '/api';
let currentWorkspaceId = localStorage.getItem('currentWorkspaceId');

async function req(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const skipWorkspaceHeader = path.startsWith('/auth/') || path.startsWith('/workspaces/join/');
  if (currentWorkspaceId && !skipWorkspaceHeader) headers['x-workspace-id'] = currentWorkspaceId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // важно для сессий
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  setWorkspace(id) {
    currentWorkspaceId = id ? String(id) : null;
    if (currentWorkspaceId) localStorage.setItem('currentWorkspaceId', currentWorkspaceId);
    else localStorage.removeItem('currentWorkspaceId');
  },
  getWorkspaceId() { return currentWorkspaceId; },

  // Auth
  getMe: () => req('GET', '/auth/me'),
  updateMe: (body) => req('PUT', '/auth/me', body),
  register: (body) => req('POST', '/auth/register', body),
  emailLogin: (body) => req('POST', '/auth/login', body),
  logout: () => req('POST', '/auth/logout'),
  resendVerify: () => req('POST', '/auth/resend-verify'),
  verifyEmail: (token) => req('GET', `/auth/verify-email?token=${encodeURIComponent(token)}`),
  forgotPassword: (email) => req('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, password) => req('POST', '/auth/reset-password', { token, password }),

  // Workspaces
  createWorkspace: (body) => req('POST', '/workspaces', body),
  updateWorkspaceSettings: (id, body) => req('PUT', `/workspaces/${id}/settings`, body),
  getWorkspace: (id) => req('GET', `/workspaces/${id}`),
  getMembers: (wsId) => req('GET', `/workspaces/${wsId}/members`),
  getInvites: (wsId) => req('GET', `/workspaces/${wsId}/invites`),
  createInvite: (wsId, body) => req('POST', `/workspaces/${wsId}/invites`, body),
  deleteInvite: (wsId, inviteId) => req('DELETE', `/workspaces/${wsId}/invites/${inviteId}`),
  joinWorkspace: (token) => req('POST', `/workspaces/join/${token}`),
  updateMember: (wsId, userId, body) => req('PUT', `/workspaces/${wsId}/members/${userId}`, body),
  removeMember: (wsId, userId) => req('DELETE', `/workspaces/${wsId}/members/${userId}`),

  // Posts
  getPosts: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/posts${q ? '?' + q : ''}`);
  },
  createPost: (body) => req('POST', '/posts', body),
  addVideoToPost: (postId, body) => req('POST', `/posts/${postId}/videos`, body),
  updatePost: (id, body) => req('PUT', `/posts/${id}`, body),
  deletePost: (id) => req('DELETE', `/posts/${id}`),
  deleteVideoFromPost: (postId, videoId) => req('DELETE', `/posts/${postId}/videos/${videoId}`),

  // Creators
  getCreators: () => req('GET', '/creators'),
  getMyCreator: () => req('GET', '/creators/me'),
  createCreator: (body) => req('POST', '/creators', body),
  updateCreator: (id, body) => req('PUT', `/creators/${id}`, body),
  deleteCreator: (id) => req('DELETE', `/creators/${id}`),

  // Videos
  getVideos: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/videos${q ? '?' + q : ''}`);
  },
  addVideo: (body) => req('POST', '/videos', body),
  refreshVideo: (id) => req('POST', `/stats/refresh-video/${id}`),
  deleteVideo: (id) => req('DELETE', `/videos/${id}`),

  // Stats
  getSummary: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/stats/summary${q ? '?' + q : ''}`);
  },
  getByCreator: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/stats/by-creator${q ? '?' + q : ''}`);
  },
  refreshAll: () => req('POST', '/stats/refresh-all'),

  // Funnel
  getFunnelPeriods: () => req('GET', '/funnel/periods'),
  getFunnelPrivate: () => req('GET', '/funnel/periods/private'),
  syncFunnelLabel: (body) => req('POST', '/funnel/periods/sync', body),
  addFunnelCreator: (body) => req('POST', '/funnel/periods/add-creator', body),
  createFunnelPeriod: (body) => req('POST', '/funnel/periods', body),
  updateFunnelPeriod: (id, body) => req('PUT', `/funnel/periods/${id}`, body),
  deleteFunnelPeriod: (id) => req('DELETE', `/funnel/periods/${id}`),
  addFunnelSnapshot: (periodId, body) => req('POST', `/funnel/periods/${periodId}/snapshots`, body),
  deleteFunnelSnapshot: (id) => req('DELETE', `/funnel/snapshots/${id}`),
  importFunnel: (rows) => req('POST', '/funnel/import', { rows }),

  // Billing
  getBillingStatus: () => req('GET', '/billing/status'),
  createPayment: (body) => req('POST', '/billing/create-payment', body),
  cancelSubscription: () => req('POST', '/billing/cancel'),
};
