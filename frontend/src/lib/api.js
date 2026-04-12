const BASE = '/api';

async function req(method, path, body, adminPwd) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const storedPwd = sessionStorage.getItem('funnel_admin_pwd');
  const pwd = adminPwd || storedPwd;
  if (pwd) headers['x-admin-password'] = pwd;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
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
  checkAdminPassword: async (pwd) => {
    try {
      await req('GET', '/funnel/periods/private', null, pwd);
      return true;
    } catch { return false; }
  },
};
