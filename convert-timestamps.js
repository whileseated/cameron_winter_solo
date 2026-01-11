#!/usr/bin/env node
/**
 * Converts YouTube timestamp HTML (copied from video descriptions)
 * into list items for newtest.html
 *
 * Usage: node convert-timestamps.js sample_lYB-ZZAG0ts.md video1
 *
 * Supports two formats:
 * 1. Original: t=XXXs...>MM:SS</a></span><span...>Title
 * 2. New: href="...t=XXXs..."...>MM:SS</a></span> Title (title after closing span)
 */

const fs = require('fs');

const inputFile = process.argv[2];
const videoId = process.argv[3] || 'video1';

if (!inputFile) {
  console.error('Usage: node convert-timestamps.js <input-file> [video-id]');
  console.error('Example: node convert-timestamps.js sample_lYB-ZZAG0ts.md video1');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');

const items = new Map(); // key: seconds, value: title (first one wins)

const normalize = (str) => str
  .replace(/\s+/g, ' ')
  .replace(/\s*<\/?[^>]+>\s*/g, ' ')
  .replace(/^[\-\–—:\s]+/, '')
  .replace(/[\-\–—:\s]+$/, '')
  .trim();

const parseSeconds = (href, displayTime) => {
  const timeMatch = href && href.match(/[&?](?:amp;)?t=(\d+)s/);
  if (timeMatch) return parseInt(timeMatch[1], 10);

  const timeStr = (displayTime || '').trim();
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

const addItem = (seconds, rawTitle) => {
  if (Number.isNaN(seconds)) return;
  const title = normalize(rawTitle || '');
  if (!title) return;
  if (!items.has(seconds)) {
    items.set(seconds, title);
  }
};

// Replace anchors with markers to simplify parsing.
const anchorRegex = /<a [^>]*href="([^"]+)"[^>]*>([\d:]+)<\/a>/gi;
const withMarkers = content.replace(anchorRegex, (_m, href, disp) => `[[TIME|${href}|${disp}]]`);

// Strip remaining tags, collapse whitespace.
const plain = withMarkers
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Walk markers and derive titles from surrounding text.
const markerRegex = /\[\[TIME\|([^|]+)\|([^\]]+)\]\]/g;
let markerMatch;
const markers = [];
while ((markerMatch = markerRegex.exec(plain)) !== null) {
  markers.push({
    index: markerMatch.index,
    length: markerMatch[0].length,
    href: markerMatch[1],
    display: markerMatch[2]
  });
}

let lastTitle = '';

markers.forEach((marker, idx) => {
  const prevEnd = idx === 0 ? 0 : markers[idx - 1].index + markers[idx - 1].length;
  const nextStart = idx === markers.length - 1 ? plain.length : markers[idx + 1].index;

  const before = normalize(plain.slice(prevEnd, marker.index));
  const after = normalize(plain.slice(marker.index + marker.length, nextStart));

  let title = '';
  if (before && before.toLowerCase() !== lastTitle.toLowerCase()) {
    title = before;
  } else if (after) {
    title = after;
  } else {
    title = before;
  }

  const seconds = parseSeconds(marker.href, marker.display);
  addItem(seconds, title);
  if (title) lastTitle = title;
});

// Sort by timestamp (in case they're out of order)
const sorted = Array.from(items.entries())
  .map(([seconds, title]) => ({ seconds, title }))
  .sort((a, b) => a.seconds - b.seconds);

// Generate HTML list items
sorted.forEach((item, index) => {
  const num = index + 1;

  // Convert seconds to MM:SS display format
  const mins = Math.floor(item.seconds / 60);
  const secs = item.seconds % 60;
  const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Capitalize first letter of each word for cleaner display
  const displayTitle = item.title
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  console.log(`          <li class="highlight" data-link-to="#${videoId}" data-start="${item.seconds}"><span class="num">${num}.</span><span class="item-text">${displayTitle}</span><span class="timestamp">${timestamp}</span></li>`);
});

console.error(`\n// Generated ${sorted.length} items for #${videoId}`);
