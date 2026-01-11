// Global state
let performancesData = null;
let loadedCards = {};
let tabs = [];
let cards = [];

const wrap = document.getElementById("wrap");
const svg = document.getElementById("overlay");
const g = document.getElementById("paths");

// Tab connector tuning knobs
const TAB_CURVE_RADIUS = 10;
const TAB_LEFT_MARGIN = 24;
const TAB_CLEARANCE = 7;
const TAB_LOCAL_DROP = 6;
const TAB_ARROW_EXTEND = 8;

const players = {};
let youtubeReady = false;
let currentlyPlayingId = null;
let currentlyPlayingLi = null;
const videoTracks = {};
const progressIntervals = {};
const POLL_INTERVAL_MS = 500;

// Prepopulated song titles for autocomplete
const SONG_TITLES = [
  "$0", "Amazing Grace", "Au Pays du Cocaine", "Can't Keep Anything",
  "Cancer Of The Skull", "Credits", "David", "Drinking Age",
  "Emperor XIII In Shades", "Enemy", "I Don't Wanna",
  "I Have Waited In The Dark", "I Will Let You Down",
  "If You Turn Back Now", "It All Fell In The River",
  "Its Been Waited For", "John Henry", "Long Island City Here I Come",
  "Love Takes Miles", "LSD", "Nausicaa (Love Will Be Revealed)",
  "Nina + Field Of Cops", "Noah", "Please", "Sandbag",
  "Serious World", "Shenandoah", "Take It With You",
  "The Rolling Stones", "The Star-Spangled Banner", "Try As I May",
  "Unreleased 1", "Unreleased 2", "Vines",
  "We're Thinking The Same Thing", "Where's Your Love Now"
];

let VENUES = [];
let CITIES = [];
const COUNTRIES = ["USA", "UK", "FR"];

let isFiltering = false;

// Song slug mapping for URL sharing (short identifiers)
const SONG_SLUGS = {
  "$0": "0",
  "Amazing Grace": "amazing",
  "Au Pays du Cocaine": "aupays",
  "Can't Keep Anything": "cantkeep",
  "Cancer Of The Skull": "cancer",
  "Credits": "credits",
  "David": "david",
  "Drinking Age": "drinking",
  "Emperor XIII In Shades": "emperor",
  "Enemy": "enemy",
  "I Don't Wanna": "idontwanna",
  "I Have Waited In The Dark": "ihavewaited",
  "I Will Let You Down": "iwilllet",
  "If You Turn Back Now": "ifyouturn",
  "It All Fell In The River": "itallfell",
  "Its Been Waited For": "itsbeenwaitedfor",
  "John Henry": "johnhenry",
  "Long Island City Here I Come": "lic",
  "Love Takes Miles": "lovetakes",
  "LSD": "lsd",
  "Nausicaa (Love Will Be Revealed)": "nausicaa",
  "Nina + Field Of Cops": "ninafield",
  "Noah": "noah",
  "Please": "please",
  "Sandbag": "sandbag",
  "Serious World": "serious",
  "Shenandoah": "shenandoah",
  "Take It With You": "takeitwithyou",
  "The Rolling Stones": "rollingstones",
  "The Star-Spangled Banner": "thestar",
  "Try As I May": "try",
  "Unreleased 1": "unreleased1",
  "Unreleased 2": "unreleased2",
  "Vines": "vines",
  "We're Thinking The Same Thing": "werethinking",
  "Where's Your Love Now": "wheresyour"
};

// Reverse mapping for lookup
const SLUG_TO_SONG = Object.fromEntries(
  Object.entries(SONG_SLUGS).map(([song, slug]) => [slug, song])
);

// URL routing utilities
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    date: params.get('date'),
    song: params.get('song')
  };
}

function updateUrl(params) {
  const url = new URL(window.location);
  if (params.date) {
    url.searchParams.set('date', params.date);
    url.searchParams.delete('song');
  } else if (params.song) {
    url.searchParams.set('song', params.song);
    url.searchParams.delete('date');
  } else {
    url.searchParams.delete('date');
    url.searchParams.delete('song');
  }
  window.history.pushState({}, '', url);
}

function getSongSlug(songTitle) {
  return SONG_SLUGS[songTitle] || null;
}

function getSongFromSlug(slug) {
  return SLUG_TO_SONG[slug] || null;
}

// 12-step ROYGBIV rainbow spectrum
const RAINBOW_COLORS = [
  '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#ADFF2F', '#32CD32',
  '#00CED1', '#1E90FF', '#0000FF', '#4B0082', '#8B00FF', '#FF1493'
];

// Utility functions
function normalizeText(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function p(x, y) {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function orthogonalRoundedPath(sx, sy, ex, ey, midX, r = 12) {
  const dir1 = Math.sign(midX - sx) || 1;
  const dir3 = Math.sign(ex - midX) || 1;
  const dirV = Math.sign(ey - sy) || 1;

  const h1 = Math.abs(midX - sx);
  const h3 = Math.abs(ex - midX);
  const v = Math.abs(ey - sy);

  const rr1 = Math.min(r, h1 / 2, v / 2);
  const rr2 = Math.min(r, h3 / 2, v / 2);

  const x1 = midX - dir1 * rr1;
  const y1 = sy;
  const x2 = midX;
  const y2 = sy + dirV * rr1;
  const x3 = midX;
  const y3 = ey - dirV * rr2;
  const x4 = midX + dir3 * rr2;
  const y4 = ey;

  return [
    `M ${p(sx, sy)}`,
    `L ${p(x1, y1)}`,
    `Q ${p(midX, sy)} ${p(x2, y2)}`,
    `L ${p(x3, y3)}`,
    `Q ${p(midX, ey)} ${p(x4, y4)}`,
    `L ${p(ex, ey)}`
  ].join(" ");
}

function getListItemId(el) {
  const items = Array.from(document.querySelectorAll("[data-link-to]"));
  return `li-${items.indexOf(el)}`;
}

// Render functions
function renderCard(dateId, perfData) {
  const cardId = `card-${dateId}`;

  // Check if card already exists
  if (document.getElementById(cardId)) {
    return document.getElementById(cardId);
  }

  const card = document.createElement('div');
  card.className = 'card';
  card.id = cardId;
  card.setAttribute('data-video-id', perfData.videos[0]?.id || '');

  const grid = document.createElement('div');
  grid.className = 'grid';

  // Left panel (setlist)
  const leftPanel = document.createElement('div');
  leftPanel.className = 'panel panel-left';
  leftPanel.id = `leftPanel-${dateId}`;

  const h2 = document.createElement('h2');
  const venueParts = [perfData.venue, perfData.city];
  if (perfData.state) venueParts.push(perfData.state);
  venueParts.push(perfData.country);
  h2.textContent = venueParts.join(', ');
  leftPanel.appendChild(h2);

  const ul = document.createElement('ul');
  perfData.setlist.forEach(song => {
    const li = document.createElement('li');
    if (song.highlight) li.className = 'highlight';

    if (song.videoId && song.start !== undefined) {
      li.setAttribute('data-link-to', `#${song.videoId}`);
      li.setAttribute('data-start', song.start);
    }

    const displayTitle = song.title + (song.partial ? ' (partial)' : '');

    li.innerHTML = `
      <span class="num">${song.num}.</span>
      <span class="item-text">${displayTitle}</span>
      <span class="timestamp">${song.timestamp || ''}</span>
    `;

    // Add playing indicator
    if (song.videoId) {
      const indicator = document.createElement('div');
      indicator.className = 'playing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      li.querySelector('.timestamp').before(indicator);
    }

    ul.appendChild(li);
  });
  leftPanel.appendChild(ul);

  // Gutter
  const gutter = document.createElement('div');
  gutter.className = 'gutter';

  // Right panel (videos)
  const videoPanel = document.createElement('div');
  videoPanel.className = 'panel video-panel';

  perfData.videos.forEach(video => {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.innerHTML = `<a href="https://www.youtube.com/watch?v=${video.youtubeId}" target="_blank" rel="noopener">${video.label}</a>`;

    const placeholder = document.createElement('div');
    placeholder.id = video.id;
    placeholder.className = 'video-placeholder';
    placeholder.setAttribute('data-youtube-id', video.youtubeId);

    wrapper.appendChild(label);
    wrapper.appendChild(placeholder);
    videoPanel.appendChild(wrapper);
  });

  grid.appendChild(leftPanel);
  grid.appendChild(gutter);
  grid.appendChild(videoPanel);
  card.appendChild(grid);

  // Insert card into DOM (before footer)
  const footer = document.getElementById('dynamic-footer');
  footer.parentNode.insertBefore(card, footer);

  // Register video tracks for this card
  card.querySelectorAll("li[data-link-to]").forEach(li => {
    const targetId = li.getAttribute("data-link-to").replace("#", "");
    const start = parseInt(li.getAttribute("data-start") || "0", 10);
    if (!videoTracks[targetId]) videoTracks[targetId] = [];
    videoTracks[targetId].push({ start, li });
  });

  Object.values(videoTracks).forEach(tracks =>
    tracks.sort((a, b) => a.start - b.start)
  );

  loadedCards[cardId] = true;
  return card;
}

function renderTabs() {
  const tabStrip = document.getElementById('tabStrip');
  tabStrip.innerHTML = '';

  // Add disabled tabs and performance tabs
  const disabledDates = ['20240228', '20250426', '20251202'];
  const allDates = [...disabledDates, ...Object.keys(performancesData.performances)].sort();

  allDates.forEach(date => {
    const tab = document.createElement('div');
    tab.className = 'date-tab';

    if (disabledDates.includes(date)) {
      tab.classList.add('disabled');
      tab.setAttribute('aria-disabled', 'true');
      tab.setAttribute('title', 'Known date, recording not yet added');
      tab.textContent = date;
    } else {
      const perfData = performancesData.performances[date];
      tab.setAttribute('data-target', `card-${date}`);
      if (perfData.complete) tab.setAttribute('data-complete', 'true');
      if (perfData.mediaType) tab.setAttribute('data-media-type', perfData.mediaType);
      tab.textContent = date;
    }

    tabStrip.appendChild(tab);
  });

  tabs = Array.from(document.querySelectorAll('.date-tab'));
}

// Drawing functions
function drawTabConnector(card, wRect) {
  const tab = document.querySelector(`.date-tab[data-target="${card.id}"]`);
  const leftPanel = card.querySelector(".panel-left");
  const strip = document.getElementById("tabStrip");
  if (!tab || !leftPanel) return;

  const tabRect = tab.getBoundingClientRect();
  const leftRect = leftPanel.getBoundingClientRect();
  const stripRect = strip.getBoundingClientRect();

  const allTabs = Array.from(document.querySelectorAll(".date-tab"));
  const rowBottoms = [...new Set(allTabs.map(t => Math.round(t.getBoundingClientRect().bottom)))].sort((a, b) => a - b);
  const tabRowBottom = Math.round(tabRect.bottom);
  const isLastRow = tabRowBottom === rowBottoms[rowBottoms.length - 1];

  const tabBottomY = tabRect.bottom - wRect.top;
  const sx = tabRect.left + tabRect.width / 2 - wRect.left;
  const syTop = tabBottomY + TAB_LOCAL_DROP;

  const ex = leftRect.left + leftRect.width / 2 - wRect.left;
  const ey = leftRect.top - wRect.top + TAB_ARROW_EXTEND;

  const stripClearY = stripRect.bottom - wRect.top + TAB_CLEARANCE;

  let d;
  if (isLastRow) {
    const dir = ex > sx ? 1 : -1;
    const horizDist = Math.abs(ex - sx);
    const vertDrop = ey - stripClearY;
    const r = Math.min(TAB_CURVE_RADIUS, horizDist / 2, vertDrop / 2);

    if (horizDist < 2) {
      d = [`M ${p(sx, tabBottomY)}`, `L ${p(ex, ey)}`].join(" ");
    } else {
      d = [
        `M ${p(sx, tabBottomY)}`,
        `L ${p(sx, stripClearY - r)}`,
        `Q ${p(sx, stripClearY)} ${p(sx + dir * r, stripClearY)}`,
        `L ${p(ex - dir * r, stripClearY)}`,
        `Q ${p(ex, stripClearY)} ${p(ex, stripClearY + r)}`,
        `L ${p(ex, ey)}`
      ].join(" ");
    }
  } else {
    const safeX = Math.max(10, (stripRect.left - wRect.left) - TAB_LEFT_MARGIN);
    const sySafe = stripClearY;
    const r1 = Math.min(TAB_CURVE_RADIUS, Math.abs(sySafe - syTop) / 2);
    const r2 = Math.min(TAB_CURVE_RADIUS, Math.abs(sySafe - syTop) / 2);

    d = [
      `M ${p(sx, tabBottomY)}`,
      `L ${p(sx, syTop - r1)}`,
      `Q ${p(sx, syTop)} ${p(sx - r1, syTop)}`,
      `L ${p(safeX + r1, syTop)}`,
      `Q ${p(safeX, syTop)} ${p(safeX, syTop + r1)}`,
      `L ${p(safeX, sySafe - r2)}`,
      `Q ${p(safeX, sySafe)} ${p(safeX + r2, sySafe)}`,
      `L ${p(ex - r2, sySafe)}`,
      `Q ${p(ex, sySafe)} ${p(ex, sySafe + r2)}`,
      `L ${p(ex, ey)}`
    ].join(" ");
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.classList.add("tab-connector");
  g.appendChild(path);
}

function drawListConnectors(card, wRect) {
  const targets = Array.from(card.querySelectorAll("[data-link-to]"));
  const connectorCount = targets.length;
  const staggerSpacing = 8;

  targets.forEach((el, index) => {
    const toSel = el.getAttribute("data-link-to");
    const target = document.querySelector(toSel);
    if (!target) return;

    if (!el.id) el.id = getListItemId(el);

    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect();

    const sx = (a.right - wRect.left);
    const sy = (a.top + a.height / 2 - wRect.top);
    const ex = (b.left - wRect.left);
    const ey = (b.top + b.height / 2 - wRect.top);

    const baseMidX = sx + (ex - sx) * 0.5;
    const totalWidth = (connectorCount - 1) * staggerSpacing;
    const startOffset = -totalWidth / 2;
    const midX = baseMidX + startOffset + (index * staggerSpacing);

    const d = orthogonalRoundedPath(sx, sy, ex, ey, midX, 10);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--line)");
    path.setAttribute("stroke-width", "1");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("marker-end", "url(#arrow)");
    path.classList.add("connector");
    path.setAttribute("data-source", el.id);
    path.setAttribute("data-color-index", index % RAINBOW_COLORS.length);

    g.appendChild(path);
  });
}

function draw() {
  const wRect = wrap.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${wRect.width} ${wRect.height}`);
  g.innerHTML = "";

  const visibleCards = isFiltering
    ? Array.from(document.querySelectorAll(".card.filter-match"))
    : [document.querySelector(".card.active")];

  visibleCards.forEach(card => {
    if (card) {
      if (!isFiltering) {
        drawTabConnector(card, wRect);
      }
      drawListConnectors(card, wRect);
    }
  });

  updatePlayingConnector();
}

// YouTube player functions
function onYouTubeIframeAPIReady() {
  youtubeReady = true;
  const activeCard = document.querySelector(".card.active");
  if (activeCard) {
    const videoPlaceholders = activeCard.querySelectorAll(".video-placeholder[data-youtube-id]");
    videoPlaceholders.forEach(placeholder => {
      if (placeholder.id) initPlayer(placeholder.id);
    });
  }
}

function initPlayer(elementId) {
  if (players[elementId]) return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const videoId = el.getAttribute("data-youtube-id");
  if (!videoId) return;

  players[elementId] = new YT.Player(elementId, {
    videoId: videoId,
    playerVars: { modestbranding: 1, rel: 0 },
    events: {
      onReady: () => setTimeout(draw, 100),
      onStateChange: (event) => {
        if (event.data === 1) {
          startProgressWatcher(elementId);
          const currentTime = event.target && event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
          syncPlayingFromTime(elementId, currentTime);
        }
        if (event.data === 0 || event.data === 2) {
          clearProgressWatcher(elementId);
          if (currentlyPlayingLi && currentlyPlayingId === elementId) {
            currentlyPlayingLi.classList.remove("playing");
            currentlyPlayingLi = null;
            currentlyPlayingId = null;
            updatePlayingConnector();
          }
        }
      }
    }
  });
}

function clearProgressWatcher(playerId) {
  if (progressIntervals[playerId]) {
    clearInterval(progressIntervals[playerId]);
    delete progressIntervals[playerId];
  }
}

function findTrackForTime(videoId, currentTime) {
  const tracks = videoTracks[videoId];
  if (!tracks || tracks.length === 0) return null;
  const tolerance = 0.6;
  let candidate = tracks[0];
  for (let i = 0; i < tracks.length; i++) {
    if (currentTime + tolerance >= tracks[i].start) {
      candidate = tracks[i];
    } else {
      break;
    }
  }
  return candidate;
}

function syncPlayingFromTime(videoId, currentTime) {
  if (currentlyPlayingId && currentlyPlayingId !== videoId) return;
  const track = findTrackForTime(videoId, currentTime);
  if (!track) return;
  if (currentlyPlayingLi !== track.li) {
    if (currentlyPlayingLi) currentlyPlayingLi.classList.remove("playing");
    currentlyPlayingLi = track.li;
    currentlyPlayingId = videoId;
    track.li.classList.add("playing");
    updatePlayingConnector();
  }
}

function startProgressWatcher(videoId) {
  clearProgressWatcher(videoId);
  const player = players[videoId];
  if (!player || !videoTracks[videoId]) return;
  progressIntervals[videoId] = setInterval(() => {
    const state = player.getPlayerState ? player.getPlayerState() : -1;
    if (state !== 1) return;
    const time = player.getCurrentTime ? player.getCurrentTime() : 0;
    syncPlayingFromTime(videoId, time);
  }, POLL_INTERVAL_MS);
}

function updatePlayingConnector() {
  g.querySelectorAll("path.connector.playing").forEach(p => {
    p.classList.remove("playing");
    if (!p.classList.contains("active")) {
      p.style.stroke = "";
      p.setAttribute("marker-end", "url(#arrow)");
    }
  });

  if (currentlyPlayingLi && currentlyPlayingLi.id) {
    const path = g.querySelector(`path[data-source="${currentlyPlayingLi.id}"]`);
    if (path) {
      const colorIndex = path.getAttribute("data-color-index") || 0;
      const color = RAINBOW_COLORS[colorIndex];
      path.classList.add("playing");
      path.style.stroke = color;
      path.setAttribute("marker-end", `url(#arrow-rainbow-${colorIndex})`);
    }
  }
}

// Card activation
function activateCard(cardId, updateHistory = true) {
  const dateId = cardId.replace('card-', '');
  const perfData = performancesData.performances[dateId];

  if (!perfData) return;

  // Update URL with date parameter
  if (updateHistory) {
    updateUrl({ date: dateId });
  }

  // Render card if not already loaded
  let card = document.getElementById(cardId);
  if (!card) {
    card = renderCard(dateId, perfData);
  }

  // Update active states
  cards = Array.from(document.querySelectorAll(".card"));
  cards.forEach(c => c.classList.remove("active"));
  card.classList.add("active");

  tabs.forEach(tab => tab.classList.toggle("active", tab.getAttribute("data-target") === cardId));

  // Initialize YouTube players
  if (youtubeReady) {
    const videoPlaceholders = card.querySelectorAll(".video-placeholder[data-youtube-id]");
    videoPlaceholders.forEach(placeholder => {
      if (placeholder.id) {
        initPlayer(placeholder.id);
      }
    });
  }

  requestAnimationFrame(() => {
    draw();
    setTimeout(draw, 50);
    setTimeout(draw, 150);
    setTimeout(draw, 300);
  });
}

// Filter functions
function getAutocompleteItems(query) {
  if (!query || query.length < 1) return [];
  const q = normalizeText(query);
  const results = [];

  SONG_TITLES.forEach(song => {
    if (normalizeText(song).includes(q)) {
      results.push({ text: song, type: 'song' });
    }
  });

  VENUES.forEach(venue => {
    if (normalizeText(venue).includes(q)) {
      results.push({ text: venue, type: 'venue' });
    }
  });

  CITIES.forEach(city => {
    if (normalizeText(city).includes(q)) {
      results.push({ text: city, type: 'city' });
    }
  });

  COUNTRIES.forEach(country => {
    if (normalizeText(country).includes(q)) {
      results.push({ text: country, type: 'country' });
    }
  });

  return results.slice(0, 10);
}

function applyFilter(query, updateHistory = true) {
  const q = normalizeText(query);

  if (!q) {
    clearFilter();
    return;
  }

  // Check if it's a song filter and update URL
  if (updateHistory) {
    const matchingSong = SONG_TITLES.find(song => normalizeText(song).includes(q));
    if (matchingSong) {
      const slug = getSongSlug(matchingSong);
      if (slug) {
        updateUrl({ song: slug });
      }
    }
  }

  const isCountryQuery = COUNTRIES.some(c => normalizeText(c) === q);
  const countryRegex = isCountryQuery ? new RegExp(`\\b${q}\\b`) : null;

  isFiltering = true;

  // Render all cards for filtering
  Object.keys(performancesData.performances).forEach(dateId => {
    const cardId = `card-${dateId}`;
    if (!document.getElementById(cardId)) {
      renderCard(dateId, performancesData.performances[dateId]);
    }
  });

  cards = Array.from(document.querySelectorAll(".card"));

  let foundSongWithoutVideo = false;
  let foundSongWithVideo = false;

  cards.forEach(card => {
    const h2 = card.querySelector("h2");
    const venueText = h2 ? normalizeText(h2.textContent) : "";
    const songItems = card.querySelectorAll("li .item-text");

    let cardMatches = isCountryQuery
      ? countryRegex.test(venueText)
      : venueText.includes(q);
    let hasMatchingSong = false;

    songItems.forEach(item => {
      const li = item.closest("li");
      const songText = normalizeText(item.textContent);
      const hasVideoLink = li.hasAttribute("data-link-to");

      // Track if we found the song at all
      if (songText.includes(q)) {
        if (hasVideoLink) {
          foundSongWithVideo = true;
          hasMatchingSong = true;
          li.classList.remove("filter-dim");
        } else {
          foundSongWithoutVideo = true;
          li.classList.add("filter-dim");
        }
      } else {
        li.classList.add("filter-dim");
      }
    });

    if (cardMatches || hasMatchingSong) {
      card.classList.remove("filter-no-match", "active");
      card.classList.add("filter-match");
      if (cardMatches) {
        songItems.forEach(item => {
          item.closest("li").classList.remove("filter-dim");
        });
      }
    } else {
      card.classList.remove("filter-match", "active");
      card.classList.add("filter-no-match");
    }
  });

  // Show message if song exists but has no videos
  const filterMessage = document.getElementById("filterMessage");
  if (filterMessage) {
    if (foundSongWithoutVideo && !foundSongWithVideo && !isCountryQuery) {
      filterMessage.textContent = "The song you've searched for exists on setlists, but does not currently have a viewable or listenable performance here.";
      filterMessage.classList.add("visible");
    } else {
      filterMessage.textContent = "";
      filterMessage.classList.remove("visible");
    }
  }

  tabs.forEach(tab => {
    const cardId = tab.getAttribute("data-target");
    const card = document.getElementById(cardId);
    if (card && card.classList.contains("filter-match")) {
      tab.style.opacity = "1";
    } else {
      tab.style.opacity = "0.15";
    }
  });

  if (youtubeReady) {
    document.querySelectorAll(".card.filter-match").forEach(card => {
      const videoPlaceholders = card.querySelectorAll(".video-placeholder[data-youtube-id]");
      videoPlaceholders.forEach(placeholder => {
        if (placeholder.id) {
          initPlayer(placeholder.id);
        }
      });
    });
  }

  requestAnimationFrame(draw);
}

function clearFilter() {
  isFiltering = false;

  // Hide filter message
  const filterMessage = document.getElementById("filterMessage");
  if (filterMessage) {
    filterMessage.textContent = "";
    filterMessage.classList.remove("visible");
  }

  cards = Array.from(document.querySelectorAll(".card"));
  cards.forEach(card => {
    card.classList.remove("filter-match", "filter-no-match");
    card.querySelectorAll("li").forEach(li => {
      li.classList.remove("filter-dim");
    });
  });

  tabs.forEach(tab => {
    tab.style.opacity = "1";
  });

  activateCard("card-20251130");
}

// Event listeners
function setupEventListeners() {
  document.getElementById("tabStrip").addEventListener("click", (e) => {
    const tab = e.target.closest(".date-tab");
    if (!tab) return;

    if (isFiltering) {
      isFiltering = false;
      filterInput.value = "";
      autocompleteList.classList.remove("visible");
      cards.forEach(card => {
        card.classList.remove("filter-match", "filter-no-match");
        card.querySelectorAll("li").forEach(li => {
          li.classList.remove("filter-dim");
        });
      });
      tabs.forEach(t => {
        t.style.opacity = "1";
      });
    }

    activateCard(tab.getAttribute("data-target"));
  });

  document.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-link-to]");
    if (!li) return;

    const targetId = li.getAttribute("data-link-to").replace("#", "");
    const startTime = parseInt(li.getAttribute("data-start") || "0", 10);
    const player = players[targetId];

    if (player && player.seekTo) {
      const isPlaying = player.getPlayerState && player.getPlayerState() === 1;
      const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
      const isNearStartTime = Math.abs(currentTime - startTime) < 5;

      if (isPlaying && isNearStartTime) {
        player.pauseVideo();
        currentlyPlayingId = null;
        if (currentlyPlayingLi) {
          currentlyPlayingLi.classList.remove("playing");
          currentlyPlayingLi = null;
        }
        updatePlayingConnector();
      } else {
        if (currentlyPlayingId && currentlyPlayingId !== targetId && players[currentlyPlayingId]) {
          const prevPlayer = players[currentlyPlayingId];
          if (prevPlayer.pauseVideo) {
            prevPlayer.pauseVideo();
          }
          clearProgressWatcher(currentlyPlayingId);
        }
        if (currentlyPlayingLi) {
          currentlyPlayingLi.classList.remove("playing");
        }
        player.seekTo(startTime, true);
        player.playVideo();
        currentlyPlayingId = targetId;
        currentlyPlayingLi = li;
        li.classList.add("playing");
        updatePlayingConnector();
      }
    }
  });

  document.addEventListener("mouseenter", (e) => {
    if (!e.target.closest) return;
    const li = e.target.closest("li[data-link-to]");
    if (!li) return;
    const path = g.querySelector(`path[data-source="${li.id}"]`);
    if (path) {
      const colorIndex = path.getAttribute("data-color-index") || 0;
      const color = RAINBOW_COLORS[colorIndex];
      path.classList.add("active");
      path.style.stroke = color;
      path.setAttribute("marker-end", `url(#arrow-rainbow-${colorIndex})`);
    }
  }, true);

  document.addEventListener("mouseleave", (e) => {
    if (!e.target.closest) return;
    const li = e.target.closest("li[data-link-to]");
    if (!li) return;
    const path = g.querySelector(`path[data-source="${li.id}"]`);
    if (path) {
      path.classList.remove("active");
      if (!path.classList.contains("playing")) {
        path.style.stroke = "";
        path.setAttribute("marker-end", "url(#arrow)");
      }
    }
  }, true);

  g.addEventListener("mouseenter", (e) => {
    const path = e.target.closest("path.connector");
    if (!path) return;
    const sourceId = path.getAttribute("data-source");
    const colorIndex = path.getAttribute("data-color-index") || 0;
    const color = RAINBOW_COLORS[colorIndex];
    const li = document.getElementById(sourceId);
    if (li) li.classList.add("active");
    path.style.stroke = color;
    path.setAttribute("marker-end", `url(#arrow-rainbow-${colorIndex})`);
  }, true);

  g.addEventListener("mouseleave", (e) => {
    const path = e.target.closest("path.connector");
    if (!path) return;
    const sourceId = path.getAttribute("data-source");
    const li = document.getElementById(sourceId);
    if (li) li.classList.remove("active");
    if (!path.classList.contains("playing")) {
      path.style.stroke = "";
      path.setAttribute("marker-end", "url(#arrow)");
    }
  }, true);

  g.addEventListener("click", (e) => {
    const path = e.target.closest("path.connector");
    if (!path) return;
    const sourceId = path.getAttribute("data-source");
    const li = document.getElementById(sourceId);
    if (li) li.click();
  });

  const ro = new ResizeObserver(draw);
  ro.observe(wrap);
  window.addEventListener("scroll", draw, { passive: true });
  window.addEventListener("resize", draw);

  // Filter/autocomplete UI
  const filterInput = document.getElementById("filterInput");
  const autocompleteList = document.getElementById("autocompleteList");
  let selectedIndex = -1;

  function showAutocomplete(items) {
    if (items.length === 0) {
      autocompleteList.classList.remove("visible");
      return;
    }

    autocompleteList.innerHTML = items.map((item, i) => `
      <div class="autocomplete-item${i === selectedIndex ? ' selected' : ''}"
           data-index="${i}" data-text="${item.text}">
        ${item.text}
        <span class="type-label">${item.type}</span>
      </div>
    `).join("");

    autocompleteList.classList.add("visible");
  }

  filterInput.addEventListener("input", (e) => {
    const query = e.target.value;
    selectedIndex = -1;

    if (query.length >= 1) {
      const items = getAutocompleteItems(query);
      showAutocomplete(items);
      applyFilter(query);
    } else {
      autocompleteList.classList.remove("visible");
      clearFilter();
    }
  });

  filterInput.addEventListener("keydown", (e) => {
    const items = autocompleteList.querySelectorAll(".autocomplete-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      items.forEach((item, i) => item.classList.toggle("selected", i === selectedIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      items.forEach((item, i) => item.classList.toggle("selected", i === selectedIndex));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selected = items[selectedIndex];
      if (selected) {
        filterInput.value = selected.dataset.text;
        autocompleteList.classList.remove("visible");
        applyFilter(selected.dataset.text);
      }
    } else if (e.key === "Escape") {
      autocompleteList.classList.remove("visible");
      filterInput.value = "";
      clearFilter();
    }
  });

  autocompleteList.addEventListener("click", (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (item) {
      filterInput.value = item.dataset.text;
      autocompleteList.classList.remove("visible");
      applyFilter(item.dataset.text);
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-container")) {
      autocompleteList.classList.remove("visible");
    }
  });
}

// Initialize rainbow markers
function createRainbowMarkers() {
  const defs = svg.querySelector('defs');
  RAINBOW_COLORS.forEach((color, i) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", `arrow-rainbow-${i}`);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "5");
    marker.setAttribute("orient", "auto-start-reverse");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill", color);
    marker.appendChild(path);
    defs.appendChild(marker);
  });
}

// Dynamic footer + timestamp
function loadFooter() {
  const footerContainer = document.getElementById("dynamic-footer");
  if (footerContainer) {
    fetch("includes/footer.html")
      .then(response => response.text())
      .then(html => {
        footerContainer.innerHTML = html;
        return fetch("includes/file-timestamps.json");
      })
      .then(response => response.json())
      .then(timestamps => {
        const filename = window.location.pathname.split("/").pop() || "index.html";
        const timestamp = timestamps[filename] || "unknown";
        const tsEl = document.getElementById("last-updated");
        if (tsEl) tsEl.textContent = timestamp;
      })
      .catch(() => {
        const tsEl = document.getElementById("last-updated");
        if (tsEl) tsEl.textContent = "unknown";
      });
  }
}

// Main initialization
async function init() {
  try {
    // Fetch performance data
    const response = await fetch('performances.json');
    performancesData = await response.json();

    // Build venues and cities lists
    Object.values(performancesData.performances).forEach(perf => {
      if (perf.venue && !VENUES.includes(perf.venue)) VENUES.push(perf.venue);
      if (perf.city && !CITIES.includes(perf.city)) CITIES.push(perf.city);
    });

    // Render tabs
    renderTabs();

    // Setup event listeners
    setupEventListeners();

    // Create rainbow markers
    createRainbowMarkers();

    // Load footer
    loadFooter();

    // Handle URL routing
    handleUrlRouting();

    // Setup popstate handler for browser back/forward
    window.addEventListener('popstate', handleUrlRouting);

  } catch (error) {
    console.error('Failed to load performance data:', error);
  }
}

// Handle URL-based routing
function handleUrlRouting() {
  const params = getUrlParams();
  const filterInput = document.getElementById("filterInput");

  if (params.date) {
    // Navigate to specific performance
    const cardId = `card-${params.date}`;
    if (performancesData.performances[params.date]) {
      activateCard(cardId, false);
    } else {
      // Invalid date, fallback to default
      activateCard("card-20251130", false);
    }
  } else if (params.song) {
    // Filter by song slug
    const songTitle = getSongFromSlug(params.song);
    if (songTitle && filterInput) {
      filterInput.value = songTitle;
      applyFilter(songTitle, false);
    } else {
      // Invalid song slug, fallback to default
      activateCard("card-20251130", false);
    }
  } else {
    // No params, show default card
    activateCard("card-20251130", false);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for YouTube API
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
