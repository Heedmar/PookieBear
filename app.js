// ---------- Supabase setup ----------
const SUPABASE_URL = 'https://ekmdskkryigycmuepuhy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZAt00p4k-CvSLn6hpU2oLg_xCmYp5gD';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let queued = [];
let watched = [];
let filterType = 'all';
let pendingRating = 0;
let hoverRating = 0;
let shuffleTimer = null;

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setSyncStatus(state) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (state === 'syncing') { el.textContent = 'Syncing\u2026'; el.classList.remove('err'); }
  else if (state === 'synced') { el.textContent = 'Synced'; el.classList.remove('err'); }
  else if (state === 'error') { el.textContent = 'Sync failed \u2014 check connection'; el.classList.add('err'); }
}

// ---------- Data sync ----------
async function refreshAll() {
  setSyncStatus('syncing');
  try {
    const res = await sb.from('watchlist').select('*').order('created_at', { ascending: true });
    if (res.error) throw res.error;
    const rows = res.data || [];
    queued = rows.filter(function (r) { return r.status !== 'watched'; });
    watched = rows.filter(function (r) { return r.status === 'watched'; }).reverse();
    setSyncStatus('synced');
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
  }
  renderQueueRows();
  renderPickGrid();
  renderWatchedGrid();
}

// ---------- Small render helpers ----------
function posterArtOnly(item) {
  const cls = item.type === 'Movie' ? 'movie' : 'show';
  const letter = ((item.title || '').trim().charAt(0) || '?').toUpperCase();
  return '<div class="poster-art ' + cls + '">' + escapeHTML(letter) + '</div>';
}
function posterCardHTML(item, extra) {
  return '<div class="poster-card">'
    + posterArtOnly(item)
    + '<div class="poster-stub"><div class="title">' + escapeHTML(item.title) + '</div>' + (extra || '') + '</div>'
    + '</div>';
}
function starsHTML(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) out += '<span class="' + (i <= rating ? 'on' : '') + '">\u2605</span>';
  return out;
}

// ---------- Add screen ----------
function renderQueueRows() {
  const el = document.getElementById('queue-rows');
  if (queued.length === 0) {
    el.innerHTML = '<div class="empty-note">Nothing queued yet, add your first pick above.</div>';
    return;
  }
  el.innerHTML = queued.map(function (it) {
    return '<div class="queue-row">'
      + '<div class="tag-bar ' + (it.type === 'Movie' ? 'movie' : 'show') + '"></div>'
      + '<div class="info"><div class="title">' + escapeHTML(it.title) + '</div>'
      + '<div class="meta">' + (it.type === 'Movie' ? 'Movie' : 'TV show') + (it.genre ? ' \u00b7 ' + escapeHTML(it.genre) : '') + '</div></div>'
      + '<button class="icon-btn" aria-label="Remove ' + escapeHTML(it.title) + '" onclick="removeItem(' + it.id + ')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>'
      + '</button></div>';
  }).join('');
}

async function addItem() {
  const titleEl = document.getElementById('new-title');
  const title = titleEl.value.trim();
  const errEl = document.getElementById('add-error');
  if (!title) {
    errEl.textContent = 'Enter a title first.';
    errEl.classList.add('show');
    return;
  }
  errEl.classList.remove('show');
  const type = document.getElementById('new-type').value;
  const genre = document.getElementById('new-genre').value.trim();
  const btn = document.getElementById('add-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await sb.from('watchlist').insert([{ title: title, type: type, genre: genre, status: 'queued' }]);
    if (res.error) throw res.error;
    titleEl.value = '';
    document.getElementById('new-genre').value = '';
    titleEl.focus();
    await refreshAll();
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Could not add \u2014 check your connection.';
    errEl.classList.add('show');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function removeItem(id) {
  try {
    const res = await sb.from('watchlist').delete().eq('id', id);
    if (res.error) throw res.error;
    await refreshAll();
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
  }
}

// ---------- Pick screen ----------
function getFilteredQueue() {
  if (filterType === 'movie') return queued.filter(function (it) { return it.type === 'Movie'; });
  if (filterType === 'show') return queued.filter(function (it) { return it.type === 'Show'; });
  return queued;
}

function renderPickGrid() {
  const el = document.getElementById('pick-grid');
  const list = getFilteredQueue();
  el.innerHTML = list.length
    ? list.map(function (it) { return posterCardHTML(it); }).join('')
    : '<div class="empty-note">Nothing in this category yet.</div>';
}

function movePill(pillId, btn, rowId) {
  if (!btn) return;
  const row = document.getElementById(rowId);
  const pill = document.getElementById(pillId);
  const rowRect = row.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  pill.style.left = (btnRect.left - rowRect.left) + 'px';
  pill.style.width = btnRect.width + 'px';
}

function setFilter(val) {
  filterType = val;
  document.querySelectorAll('#filter-row button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.filter === val);
  });
  movePill('filter-pill', document.querySelector('#filter-row button[data-filter="' + val + '"]'), 'filter-row');
  renderPickGrid();
}

function pickOne() {
  const list = getFilteredQueue();
  const resultEl = document.getElementById('pick-result');
  if (list.length === 0) {
    resultEl.innerHTML = '<div class="empty-note">Add something to this category first.</div>';
    return;
  }
  if (shuffleTimer) clearInterval(shuffleTimer);
  let ticks = 0;
  const maxTicks = 10;
  const finalChoice = list[Math.floor(Math.random() * list.length)];
  shuffleTimer = setInterval(function () {
    const temp = list[Math.floor(Math.random() * list.length)];
    resultEl.innerHTML = '<div class="reveal-card shuffling">' + posterArtOnly(temp)
      + '<div class="info"><div class="title">' + escapeHTML(temp.title) + '</div></div></div>';
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(shuffleTimer);
      showFinalPick(finalChoice);
    }
  }, 70);
}

function showFinalPick(choice) {
  pendingRating = 0;
  hoverRating = 0;
  const resultEl = document.getElementById('pick-result');
  resultEl.innerHTML = [
    '<div class="reveal-card">',
    posterArtOnly(choice),
    '<div class="info">',
    '<div class="title">' + escapeHTML(choice.title) + '</div>',
    '<div class="meta">' + (choice.type === 'Movie' ? 'Movie' : 'TV show') + (choice.genre ? ' \u00b7 ' + escapeHTML(choice.genre) : '') + '</div>',
    '<div class="rate-label">Rate it after you watch:</div>',
    '<div class="star-picker" id="star-picker-inner"></div>',
    '<div class="reveal-actions">',
    '<button class="btn btn-secondary" onclick="pickOne()">Reroll</button>',
    '<button class="btn btn-primary" onclick="markWatched(' + choice.id + ')">Mark watched</button>',
    '</div>',
    '</div>',
    '</div>'
  ].join('');
  renderStarPicker();
}

function renderStarPicker() {
  const el = document.getElementById('star-picker-inner');
  if (!el) return;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += '<span class="star" data-val="' + i + '" '
      + 'onmouseenter="previewRating(' + i + ')" onmouseleave="previewRating(0)" onclick="setPendingRating(' + i + ')" '
      + 'role="button" tabindex="0" aria-label="Rate ' + i + ' out of 5">\u2605</span>';
  }
  el.innerHTML = html;
  updateStarDisplay();
}
function updateStarDisplay() {
  const el = document.getElementById('star-picker-inner');
  if (!el) return;
  const active = hoverRating > 0 ? hoverRating : pendingRating;
  el.querySelectorAll('.star').forEach(function (node) {
    node.classList.toggle('on', parseInt(node.dataset.val, 10) <= active);
  });
}
function previewRating(n) { hoverRating = n; updateStarDisplay(); }
function setPendingRating(n) { pendingRating = n; hoverRating = 0; updateStarDisplay(); }

async function markWatched(id) {
  const rating = pendingRating || 3;
  try {
    const res = await sb.from('watchlist').update({ status: 'watched', rating: rating }).eq('id', id);
    if (res.error) throw res.error;
    document.getElementById('pick-result').innerHTML = '<div class="empty-note">Saved to watched.</div>';
    await refreshAll();
  } catch (e) {
    console.error(e);
    document.getElementById('pick-result').innerHTML = '<div class="empty-note">Could not save \u2014 check your connection.</div>';
  }
}

// ---------- Watched screen ----------
function renderWatchedGrid() {
  const el = document.getElementById('watched-grid');
  const statEl = document.getElementById('watched-stat');
  if (watched.length === 0) {
    el.innerHTML = '<div class="empty-note">Nothing watched yet.</div>';
    statEl.textContent = '';
    return;
  }
  const avg = watched.reduce(function (s, i) { return s + (i.rating || 0); }, 0) / watched.length;
  statEl.textContent = watched.length + ' watched \u00b7 average ' + avg.toFixed(1) + ' stars';
  el.innerHTML = watched.map(function (it) {
    return posterCardHTML(it, '<div class="stars">' + starsHTML(it.rating) + '</div>');
  }).join('');
}

// ---------- Nav ----------
function showScreen(name) {
  ['add', 'pick', 'watched'].forEach(function (s) {
    document.getElementById('screen-' + s).classList.toggle('active', s === name);
    document.getElementById('navbtn-' + s).classList.toggle('active', s === name);
  });
  if (name === 'pick') {
    requestAnimationFrame(function () {
      movePill('filter-pill', document.querySelector('#filter-row button[data-filter="' + filterType + '"]'), 'filter-row');
    });
  }
  refreshAll();
}

window.addEventListener('focus', refreshAll);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) refreshAll();
});

// ---------- Init ----------
refreshAll();

const titleInput = document.getElementById('new-title');
if (titleInput) {
  titleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addItem();
  });
}
