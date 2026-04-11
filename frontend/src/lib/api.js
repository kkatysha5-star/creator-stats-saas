const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
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
};
