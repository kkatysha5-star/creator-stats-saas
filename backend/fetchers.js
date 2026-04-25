// ─── YouTube ──────────────────────────────────────────────────────────────────
export function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchYoutubeStats(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data = await res.json();
  if (!data.items?.length) throw new Error('Video not found');

  const item = data.items[0];
  const s = item.statistics;

  return {
    title: item.snippet.title,
    published_at: item.snippet.publishedAt?.split('T')[0],
    views: parseInt(s.viewCount || 0),
    likes: parseInt(s.likeCount || 0),
    comments: parseInt(s.commentCount || 0),
    saves: null,
    shares: null,
  };
}

// ─── TikTok (public page scraping) ───────────────────────────────────────────
export function extractTiktokId(url) {
  const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return m ? m[1] : null;
}

export async function fetchTiktokStats(videoId, originalUrl) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.tiktok.com/',
  };

  let targetUrl = originalUrl;
  if (originalUrl && (originalUrl.includes('vm.tiktok.com') || originalUrl.includes('vt.tiktok.com'))) {
    try {
      const r = await fetch(originalUrl, { method: 'HEAD', redirect: 'follow', headers });
      targetUrl = r.url;
    } catch (_) {}
  }

  const fetchUrl = videoId
    ? `https://www.tiktok.com/@placeholder/video/${videoId}`
    : targetUrl;

  const res = await fetch(fetchUrl, { headers });
  if (!res.ok) throw new Error(`TikTok fetch error: ${res.status}`);
  const html = await res.text();

  const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (sigiMatch) {
    try {
      const sigi = JSON.parse(sigiMatch[1]);
      const itemModule = sigi?.ItemModule;
      const item = itemModule ? Object.values(itemModule)[0] : sigi?.itemInfo?.itemStruct;
      if (item) {
        const s = item.stats || item.statistics || {};
        return {
          title: item.desc || 'TikTok video',
          published_at: item.createTime ? new Date(item.createTime * 1000).toISOString().split('T')[0] : null,
          views: parseInt(s.playCount || s.viewCount || 0),
          likes: parseInt(s.diggCount || s.likeCount || 0),
          comments: parseInt(s.commentCount || 0),
          saves: parseInt(s.collectCount || 0) || null,
          shares: parseInt(s.shareCount || 0) || null,
        };
      }
    } catch (_) {}
  }

  const playCount    = html.match(/"playCount"\s*:\s*(\d+)/)?.[1];
  const diggCount    = html.match(/"diggCount"\s*:\s*(\d+)/)?.[1];
  const commentCount = html.match(/"commentCount"\s*:\s*(\d+)/)?.[1];
  const shareCount   = html.match(/"shareCount"\s*:\s*(\d+)/)?.[1];
  const collectCount = html.match(/"collectCount"\s*:\s*(\d+)/)?.[1];
  const desc         = html.match(/"desc"\s*:\s*"([^"]+)"/)?.[1];
  const createTime   = html.match(/"createTime"\s*:\s*"?(\d+)"?/)?.[1];

  if (!playCount) throw new Error('Could not parse TikTok stats — video may be private or TikTok changed its page structure');

  return {
    title: desc || 'TikTok video',
    published_at: createTime ? new Date(parseInt(createTime) * 1000).toISOString().split('T')[0] : null,
    views: parseInt(playCount || 0),
    likes: parseInt(diggCount || 0),
    comments: parseInt(commentCount || 0),
    saves: collectCount ? parseInt(collectCount) : null,
    shares: shareCount ? parseInt(shareCount) : null,
  };
}

// ─── Instagram via Apify ─────────────────────────────────────────────────────
// Кэш: не дёргаем одно видео чаще раза в 12 часов — экономим кредиты Apify
const instagramCache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 часов

export function clearInstagramCache() {
  instagramCache.clear();
  console.log('[instagram] Cache cleared');
}

export function extractInstagramId(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function fetchInstagramStats(shortcode, originalUrl) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN not set');

  // Проверяем кэш
  const cacheKey = shortcode || originalUrl;
  const cached = instagramCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.data;
  }

  const postUrl = originalUrl || `https://www.instagram.com/reel/${shortcode}/`;

  // Используем проверенный instagram-scraper с правильными полями
  const runRes = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=' + token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [postUrl],
        resultsType: 'posts',
        resultsLimit: 1,
      }),
    }
  );

  if (!runRes.ok) throw new Error(`Apify API error: ${runRes.status}`);
  const items = await runRes.json();

  if (!items?.length) throw new Error('Instagram post not found via Apify');

  const post = items[0];

  // Временный лог для диагностики — видно все числовые поля Apify
  console.log('[instagram] Apify raw view fields for', shortcode || originalUrl, {
    playCount:        post.playCount,
    videoPlayCount:   post.videoPlayCount,
    videoViewCount:   post.videoViewCount,
    likesCount:       post.likesCount,
    commentsCount:    post.commentsCount,
    type:             post.type,
    url:              post.url,
  });

  // playCount — то что Instagram показывает в интерфейсе (все воспроизведения)
  // videoViewCount — уникальные зрители (меньшее число, ≠ тому что видит пользователь)
  const views = parseInt(post.playCount ?? post.videoPlayCount ?? post.videoViewCount ?? 0);

  const data = {
    title: (post.caption || post.alt || 'Instagram video').substring(0, 100),
    published_at: post.timestamp
      ? new Date(post.timestamp).toISOString().split('T')[0]
      : null,
    views,
    likes: parseInt(post.likesCount || 0),
    comments: parseInt(post.commentsCount || 0),
    saves: null,
    shares: null,
  };

  // Сохраняем в кэш
  instagramCache.set(cacheKey, { data, fetchedAt: Date.now() });

  return data;
}

// ─── Universal dispatcher ─────────────────────────────────────────────────────
export async function fetchStatsForVideo(video) {
  const { platform, url, video_id } = video;

  if (platform === 'youtube') {
    const id = video_id || extractYoutubeId(url);
    if (!id) throw new Error('Cannot extract YouTube video ID');
    return fetchYoutubeStats(id);
  }

  if (platform === 'tiktok') {
    const id = video_id || extractTiktokId(url);
    return fetchTiktokStats(id, url);
  }

  if (platform === 'instagram') {
    const id = video_id || extractInstagramId(url);
    return fetchInstagramStats(id, url);
  }

  throw new Error(`Unknown platform: ${platform}`);
}

export function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
}

export function extractVideoId(url, platform) {
  if (platform === 'youtube') return extractYoutubeId(url);
  if (platform === 'tiktok') return extractTiktokId(url);
  if (platform === 'instagram') return extractInstagramId(url);
  return null;
}
