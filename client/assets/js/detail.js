// Detail page: load a title by ?id= and render its info + similar titles.
(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    // Parse date-only strings as local dates: `new Date('YYYY-MM-DD')` is UTC
    // midnight and renders as the previous day in negative-offset timezones.
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function posterCard(t, matchPct, idx) {
    const year = t.release_date ? '<span><i class="bi bi-calendar3 me-1"></i>' + releaseYear(t.release_date) + '</span>' : '';
    const img = t.poster_path
      ? '<img src="' + tmdbImage(t.poster_path, 'w342') + '" alt="' + escapeHtml(t.title) + '" class="w-100" loading="lazy" style="aspect-ratio:2/3;object-fit:cover;">'
      : '<div class="w-100 d-flex align-items-center justify-content-center" style="aspect-ratio:2/3;background:var(--surface-2);"><i class="bi bi-film" style="font-size:3rem;color:var(--muted);"></i></div>';
    const rating = '<span class="rating-pill position-absolute top-0 start-0 m-2"><i class="bi bi-star-fill"></i> ' + (t.vote_average || 0).toFixed(1) + '</span>';
    const match = matchPct != null
      ? '<span class="type-badge" style="border-color:rgba(45,212,191,.55);color:#2dd4bf;">' + matchPct + '% Match</span>'
      : '';
    return '<div class="col-6 col-sm-4 col-md-3 col-lg-2 reveal" style="transition-delay:calc(' + (idx || 0) + ' * 45ms);">' +
      '<a href="detail.html?id=' + t.id + '" class="poster-card d-block text-decoration-none" aria-label="View ' + escapeHtml(t.title) + '">' +
        img + rating + match +
        '<span class="card-overlay">' +
          '<span class="text-white fw-semibold" style="font-size:.95rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHtml(t.title) + '</span>' +
          '<span class="d-flex align-items-center gap-2 mt-1 small" style="color:var(--muted);">' +
            year +
            '<span class="badge-view ms-auto"><i class="bi bi-arrow-up-right"></i></span>' +
          '</span>' +
        '</span>' +
      '</a>' +
    '</div>';
  }

  function render(data) {
    document.title = data.title.title + ' – The Recommender';
    const t = data.title;

    const backdrop = document.getElementById('detailBackdrop');
    if (t.backdrop_path) {
      backdrop.style.backgroundImage = "url('" + tmdbImage(t.backdrop_path, 'w1280') + "')";
    }

    const poster = document.getElementById('detailPoster');
    if (t.poster_path) {
      poster.innerHTML = '<img src="' + tmdbImage(t.poster_path, 'w342') + '" alt="' + escapeHtml(t.title) + '" class="detail-poster img-fluid rounded-4" loading="eager">';
    } else {
      poster.innerHTML = '<div class="detail-poster rounded-4 d-flex align-items-center justify-content-center" style="aspect-ratio:2/3;background:var(--surface-2);"><i class="bi bi-film" style="font-size:4rem;color:var(--muted);"></i></div>';
    }

    document.getElementById('detailTitle').textContent = t.title;
    document.getElementById('detailOverview').textContent = t.overview || 'No overview available yet.';

    let meta = '<span class="rating-pill" style="background:var(--gradient);border:none;color:#0b0d14;"><i class="bi bi-star-fill me-1" style="color:#0b0d14;"></i>' + (t.vote_average || 0).toFixed(1) + '</span>';
    if (t.release_date) meta += '<span class="meta-chip"><i class="bi bi-calendar3 me-1"></i>' + releaseYear(t.release_date) + '</span>';
    meta += '<span class="meta-chip"><i class="bi bi-film me-1"></i>' + (t.media_type || '').charAt(0).toUpperCase() + (t.media_type || '').slice(1) + '</span>';
    meta += '<span class="meta-chip"><i class="bi bi-activity me-1"></i>' + (t.popularity || 0).toFixed(1) + ' popularity</span>';
    document.getElementById('detailMeta').innerHTML = meta;

    const info = [
      ['Released', formatDate(t.release_date)],
      ['Rating', (t.vote_average || 0).toFixed(1)],
      ['Votes', t.vote_count ? Number(t.vote_count).toLocaleString() : '—'],
      ['Type', (t.media_type || '').charAt(0).toUpperCase() + (t.media_type || '').slice(1)],
      ['Popularity', (t.popularity || 0).toFixed(1)],
      ['Language', t.original_language ? t.original_language.toUpperCase() : '—'],
    ];
    document.getElementById('infoGrid').innerHTML = info.map(([label, value]) =>
      '<div class="col-6 col-md-4 col-lg-2"><div class="info-tile reveal"><small>' + escapeHtml(label) + '</small><div class="info-value">' + escapeHtml(value) + '</div></div></div>'
    ).join('');

    const similar = data.similar || [];
    if (similar.length) {
      document.getElementById('similarSection').style.display = '';
      document.getElementById('similarGrid').innerHTML = similar.map((s, i) =>
        posterCard(s, Math.round((parseFloat(s.similarity_score) || 0) * 100), i)
      ).join('');
    }

    // reveal newly injected elements
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  function showError() {
    document.getElementById('detailError').style.display = '';
    document.getElementById('detailTitle').textContent = 'Title not found';
    document.getElementById('detailOverview').textContent = '';
    document.getElementById('detailMeta').innerHTML = '';
    document.title = 'Title not found – The Recommender';
  }

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      showError();
      return;
    }
    try {
      const data = await apiFetch('/titles/' + encodeURIComponent(id));
      render(data);
    } catch (err) {
      showError();
    }
  }

  // Local watchlist/favorites (no accounts, so persistence lives in the browser).
  const STORAGE_KEYS = {
    watchlist: 'recommender.watchlist',
    favorite: 'recommender.favorites',
  };

  function readList(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function writeList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }

  function isSaved(key, id) {
    return id != null && readList(key).indexOf(String(id)) !== -1;
  }

  function toggleSaved(key, id) {
    const list = readList(key);
    const idx = list.indexOf(String(id));
    if (idx === -1) list.push(String(id)); else list.splice(idx, 1);
    writeList(key, list);
    return idx === -1;
  }

  async function copyLink() {
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      window.showToast('Link copied to clipboard', 'bi-link-45deg');
    } catch (e) {
      window.showToast('Could not copy the link', 'bi-exclamation-triangle');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();

    // Parallax backdrop
    const bg = document.getElementById('detailBackdrop');
    window.addEventListener('scroll', () => {
      if (bg) bg.style.transform = 'translateY(' + (window.scrollY * 0.35) + 'px)';
    }, { passive: true });

    const titleId = new URLSearchParams(window.location.search).get('id');
    const watchBtn = document.querySelector('[data-action="watchlist"]');
    const favBtn = document.querySelector('[data-action="favorite"]');

    function syncActions() {
      if (!titleId) return;
      if (watchBtn) watchBtn.classList.toggle('active', isSaved(STORAGE_KEYS.watchlist, titleId));
      if (favBtn) favBtn.classList.toggle('active', isSaved(STORAGE_KEYS.favorite, titleId));
    }
    syncActions();

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        btn.style.transform = 'scale(.95)';
        setTimeout(() => { btn.style.transform = ''; }, 350);

        if (action === 'share') {
          copyLink();
          return;
        }
        if (!titleId) return;

        if (action === 'watchlist') {
          const added = toggleSaved(STORAGE_KEYS.watchlist, titleId);
          syncActions();
          window.showToast(added ? 'Added to your Watchlist' : 'Removed from your Watchlist', 'bi-plus-circle');
        } else if (action === 'favorite') {
          const added = toggleSaved(STORAGE_KEYS.favorite, titleId);
          syncActions();
          window.showToast(added ? 'Saved to Favorites' : 'Removed from Favorites', 'bi-heart-fill');
        }
      });
    });
  });
})();