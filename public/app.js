const statusEl = document.querySelector('#status');
const resultsEl = document.querySelector('#results');

function formatRelativeDate(isoDate) {
  const diffSeconds = Math.round((new Date(isoDate) - new Date()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const hours = Math.round(diffSeconds / 3600);
  if (Math.abs(hours) >= 1) {
    return rtf.format(hours, 'hour');
  }

  const minutes = Math.round(diffSeconds / 60);
  return rtf.format(minutes, 'minute');
}

function renderVideos(videos) {
  if (!videos.length) {
    statusEl.textContent = 'No mashups found in the last 24 hours. Check back soon!';
    return;
  }

  statusEl.textContent = `Showing ${videos.length} mashups from the last 24 hours (newest first)`;

  const html = videos.map(video => {
    const timeLabel = formatRelativeDate(video.date);
    const sourceLabel = video.source === 'youtube' ? 'YouTube' : 'TikTok';
    const safeTitle = video.title.replace(/"/g, '&quot;');

    let playerHtml = '';
    if (video.source === 'youtube') {
      playerHtml = `
        <iframe
          src="${video.embedUrl}"
          title="${safeTitle}"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen>
        </iframe>
      `;
    } else {
      playerHtml = `
        <a href="${video.link}" target="_blank" rel="noopener" class="tiktok-preview" aria-label="Watch ${safeTitle} on TikTok">
          ${video.thumbnail ? `<img src="${video.thumbnail}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">` : ''}
          <div class="play-overlay" aria-hidden="true">
            <span class="play-icon">▶</span>
          </div>
          <span class="watch-pill">Watch on TikTok ↗</span>
        </a>
      `;
    }

    return `
      <article class="video-card" data-source="${video.source}">
        <div class="player-wrapper">
          ${playerHtml}
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="badge ${video.source}">${sourceLabel}</span>
            <time datetime="${video.date}">${timeLabel}</time>
          </div>
          <h2 class="card-title">
            <a href="${video.link}" target="_blank" rel="noopener">${video.title}</a>
          </h2>
          <div class="card-author">
            By <a href="${video.authorUrl}" target="_blank" rel="noopener">${video.author}</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  resultsEl.innerHTML = html;
}

async function init() {
  try {
    const response = await fetch('/api/mashups');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const videos = await response.json();
    renderVideos(videos);
  } catch (error) {
    console.error('Failed to load mashups:', error);
    statusEl.textContent = ' ❌ Could not load mashups right now. Please try again later.';
    statusEl.classList.add('error');
  }
}

init();
