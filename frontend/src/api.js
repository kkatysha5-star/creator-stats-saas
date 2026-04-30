const BASE = '/api';
let currentWorkspaceId = null;

async function req(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (currentWorkspaceId) headers['x-workspace-id'] = currentWorkspaceId;

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
  setWorkspace(id) { currentWorkspaceId = id; },

  // Auth
  getMe: () => req('GET', '/auth/me'),
  logout: () => req('POST', '/auth/logout'),

  // Workspaces
  createWorkspace: (body) => req('POST', '/workspaces', body),
  getWorkspace: (id) => req('GET', `/workspaces/${id}`),
  getMembers: (wsId) => req('GET', `/workspaces/${wsId}/members`),
  createInvite: (wsId, body) => req('POST', `/workspaces/${wsId}/invites`, body),
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
  createCreator: (body) => req('POST', '/creators', body),
  updateCreator: (id, body) => req('PUT', `/creators/${id}`, body),
  deleteCreator: (id) => req('DELETE', `/creators/${id}`),

  // Videos
  getVideos: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/videos${q ? '?' + q : ''}`);
  },
  addVideo: (body) => req('POST', '/videos', body),
  refreshVideo: (id) => req('POST', `/videos/${id}/refresh`),
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
  createFunnelPeriod: (body) => req('POST', '/funnel/periods', body),
  updateFunnelPeriod: (id, body) => req('PUT', `/funnel/periods/${id}`, body),
  deleteFunnelPeriod: (id) => req('DELETE', `/funnel/periods/${id}`),
  addFunnelSnapshot: (periodId, body) => req('POST', `/funnel/periods/${periodId}/snapshots`, body),
  deleteFunnelSnapshot: (id) => req('DELETE', `/funnel/snapshots/${id}`),
};
