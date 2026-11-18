import { getStore } from '@netlify/blobs';

const SEARCH_TERM = 'mashup';
const API_URL = 'https://www.searchapi.io/api/v1/search';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * Converts a YouTube relative time string (e.g., "3h ago", "45 minutes ago", "1d ago")
 * into a JavaScript Date object if it falls within the last 24 hours.
 * Returns null if the video is older than 24 hours or cannot be parsed.
 */
function parseRelativeTime(timeStr) {
  if (!timeStr) return null;

  const lower = timeStr.toLowerCase();
  const match = lower.match(/(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day)\b/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2][0]; // 's', 'm', 'h', or 'd'
  const now = Date.now();

  if (unit === 's') {
    return new Date(now - amount * 1000);
  }
  if (unit === 'm') {
    return new Date(now - amount * 60 * 1000);
  }
  if (unit === 'h' && amount <= 24) {
    return new Date(now - amount * 60 * 60 * 1000);
  }
  if (unit === 'd' && amount === 1) {
    return new Date(now - 24 * 60 * 60 * 1000);
  }

  return null;
}

async function getYouTubeMashups(apiKey) {
  const params = new URLSearchParams({
    engine: 'youtube',
    q: SEARCH_TERM,
    api_key: apiKey
  });

  const res = await fetch(`${API_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`YouTube search failed: ${res.statusText}`);
  }

  const data = await res.json();
  const videos = data.videos || [];
  const results = [];

  for (const video of videos) {
    const publishedDate = parseRelativeTime(video.published_time);
    if (publishedDate && video.id) {
      results.push({
        id: video.id,
        source: 'youtube',
        title: video.title,
        author: video.channel?.title || 'Unknown Creator',
        authorUrl: video.channel?.link || '#',
        date: publishedDate.toISOString(),
        publishedText: video.published_time,
        embedUrl: `https://www.youtube.com/embed/${video.id}`,
        link: video.link
      });
    }
  }

  return results;
}

async function getTikTokMashups(apiKey) {
  const params = new URLSearchParams({
    engine: 'tiktok_search',
    q: SEARCH_TERM,
    time_period: 'last_day',
    filter_by: 'videos',
    api_key: apiKey
  });

  const res = await fetch(`${API_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`TikTok search failed: ${res.statusText}`);
  }

  const data = await res.json();
  const videos = data.videos || [];

  return videos
    .filter(video => video.id && video.iso_date)
    .map(video => {
      const publishedDate = new Date(video.iso_date);
      return {
        id: video.id,
        source: 'tiktok',
        title: video.caption || 'Untitled Mashup',
        author: video.author?.name || video.author?.username || 'Unknown Creator',
        authorUrl: `https://www.tiktok.com/@${video.author?.username || ''}`,
        date: publishedDate.toISOString(),
        publishedText: publishedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        thumbnail: video.dynamic_thumbnail || video.thumbnail || video.music?.cover || '',
        link: video.link
      };
    });
}

export default async (req, context) => {
  const apiKey = Netlify.env.get('SEARCHAPI_KEY');
  if (!apiKey) {
    return Response.json(
      { error: 'Missing SEARCHAPI_KEY environment variable.' },
      { status: 500 }
    );
  }

  try {
    const store = getStore('mashup-cache');
    const cached = await store.get('latest-results', { type: 'json' });

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('Returning cached mashups from Netlify Blobs');
      return Response.json(cached.results);
    }

    console.log('Cache miss or expired — fetching fresh mashups from SearchApi');
    const [youtubeResults, tiktokResults] = await Promise.all([
      getYouTubeMashups(apiKey),
      getTikTokMashups(apiKey)
    ]);

    const combined = [...youtubeResults, ...tiktokResults];

    // Sort newest first
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    await store.setJSON('latest-results', {
      timestamp: Date.now(),
      results: combined
    });

    return Response.json(combined);
  } catch (error) {
    console.error('Error fetching mashups:', error);
    return Response.json(
      { error: 'Failed to load mashup videos.' },
      { status: 500 }
    );
  }
};

export const config = {
  path: '/api/mashups'
};
