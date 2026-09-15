// ---------- Data layer ----------
function loadQueued() {
  try { return JSON.parse(localStorage.getItem('watchnext_queued') || '[]'); }
  catch (e) { return []; }
}
function loadWatched() {
  try { return JSON.parse(localStorage.getItem('watchnext_watched') || '[]'); }
  catch (e) { return []; }
}
function saveQueued() {
  try { localStorage.setItem('watchnext_queued', JSON.stringify(queued)); } catch (e) {}
}
function saveWatched() {
  try { localStorage.setItem('watchnext_watched', JSON.stringify(watched)); } catch (e) {}
}
function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let queued = loadQueued();
let watched = loadWatched();
let filterType = 'all';
let pendingRating = 0;
let hoverRating = 0;
let shuffleTimer = null;

// ---------- Small render helpers ----------
function posterArtOnly(item) {
  const cls = item.type === 'Movie' ? 'movie' : 'show';
  const letter = (item.title.trim().charAt(0) || '?').toUpperCase();
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
      + '<button class="icon-btn" aria-label="Remove ' + escapeHTML(it.title) + '" onclick="removeItem(\'' + it.id + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>'
      + '</button></div>';
  }).join('');
}

function addItem() {
  const titleEl = document.getElementById('new-title');
  const title = titleEl.value.trim();
  const errEl = document.getElementById('add-error');
  if (!title) { errEl.classList.add('show'); return; }
  errEl.classList.remove('show');
  const type = document.getElementById('new-type').value;
  const genre = document.getElementById('new-genre').value.trim();
  queued.push({ id: genId(), title: title, type: type, genre: genre });
  saveQueued();
  titleEl.value = '';
  document.getElementById('new-genre').value = '';
  titleEl.focus();
  renderQueueRows();
  renderPickGrid();
}

function removeItem(id) {
  queued = queued.filter(function (it) { return it.id !== id; });
  saveQueued();
  renderQueueRows();
  renderPickGrid();
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
    '<button class="btn btn-primary" onclick="markWatched(\'' + choice.id + '\')">Mark watched</button>',
    '</div>',
    '</div>',
    '</div>'
  ].join('');
  renderStarPicker();
}

function renderStarPicker() {
  const el = document.getElementById('star-picker-inner');
  if (!el) return;
  const active = hoverRating > 0 ? hoverRating : pendingRating;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += '<span class="star' + (i <= active ? ' on' : '') + '" '
      + 'onmouseenter="previewRating(' + i + ')" onmouseleave="previewRating(0)" onclick="setPendingRating(' + i + ')" '
      + 'role="button" tabindex="0" aria-label="Rate ' + i + ' out of 5">\u2605</span>';
  }
  el.innerHTML = html;
}
function previewRating(n) { hoverRating = n; renderStarPicker(); }
function setPendingRating(n) { pendingRating = n; hoverRating = 0; renderStarPicker(); }

function markWatched(id) {
  const idx = queued.findIndex(function (it) { return it.id === id; });
  if (idx === -1) return;
  const item = queued[idx];
  queued.splice(idx, 1);
  watched.unshift({ id: item.id, title: item.title, type: item.type, genre: item.genre, rating: pendingRating || 3 });
  saveQueued();
  saveWatched();
  renderQueueRows();
  renderPickGrid();
  renderWatchedGrid();
  document.getElementById('pick-result').innerHTML = '<div class="empty-note">Saved to watched.</div>';
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
  const avg = watched.reduce(function (s, i) { return s + i.rating; }, 0) / watched.length;
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
}

window.addEventListener('resize', function () {
  if (document.getElementById('screen-pick').classList.contains('active')) {
    movePill('filter-pill', document.querySelector('#filter-row button[data-filter="' + filterType + '"]'), 'filter-row');
  }
});

// ---------- Init ----------
renderQueueRows();
renderPickGrid();
renderWatchedGrid();

const titleInput = document.getElementById('new-title');
if (titleInput) {
  titleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addItem();
  });
}
