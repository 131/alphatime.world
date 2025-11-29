const localePath = 'locales/locale.json';
const letterGridEl = document.getElementById('letter-grid');
const formattedEl = document.getElementById('formatted-time');
const formattedNoteEl = document.getElementById('formatted-note');
const offsetInput = document.getElementById('offset');
const meetingInput = document.getElementById('meeting-time');
const meetingNameInput = document.getElementById('meeting-name');
const letterDisplay = document.getElementById('letter-display');
const offsetDisplay = document.getElementById('offset-display');
const copyBtn = document.getElementById('copy-btn');
const localOffsetBadge = document.getElementById('local-offset');
const howList = document.getElementById('how-list');

const positiveLetters = ['Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M'];
const negativeLetters = ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];

let translations = {};
let activeLocale = 'en-us';

const pad = (num) => String(num).padStart(2, '0');

function offsetToLetter(offset) {
  if (offset === 0) return 'Z';
  if (offset > 0 && offset <= 12) return positiveLetters[offset];
  if (offset < 0 && offset >= -12) return negativeLetters[Math.abs(offset) - 1];
  return '?';
}

function letterEntries() {
  const entries = [{ letter: 'Z', offset: 0 }];
  for (let i = 1; i <= 12; i += 1) {
    entries.push({ letter: positiveLetters[i], offset: i });
  }
  for (let i = 1; i <= 12; i += 1) {
    entries.push({ letter: negativeLetters[i - 1], offset: -i });
  }
  return entries;
}

function formatOffset(offset) {
  const sign = offset >= 0 ? '+' : '';
  return `${sign}${offset}`;
}

function renderLetterGrid() {
  const entries = letterEntries();
  const sorted = entries.sort((a, b) => b.offset - a.offset);
  letterGridEl.innerHTML = '';
  sorted.forEach(({ letter, offset }) => {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 mb-3';
    col.innerHTML = `
      <div class="border rounded p-3 h-100 letter-card">
        <div class="d-flex justify-content-between align-items-center">
          <span class="fw-bold fs-5">${letter}</span>
          <span class="badge bg-secondary">${translations.referenceUTC || 'UTC'}${formatOffset(offset)}</span>
        </div>
        <div class="text-muted small mt-2">${offset >= 0 ? '+' : ''}${offset}h</div>
      </div>
    `;
    letterGridEl.appendChild(col);
  });
}

function detectLocale(available) {
  const browserLang = (navigator.language || 'en-us').toLowerCase();
  if (available[browserLang]) return browserLang;
  const short = browserLang.split('-')[0];
  if (available[short]) return short;
  return 'en-us';
}

function renderList(items) {
  howList.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    howList.appendChild(li);
  });
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (key === 'howList' && Array.isArray(translations.howList)) {
      renderList(translations.howList);
      return;
    }
    const value = translations[key];
    if (!value || Array.isArray(value)) return;
    node.textContent = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (translations[key]) {
      node.placeholder = translations[key];
    }
  });
}

async function loadLocale() {
  try {
    const res = await fetch(localePath);
    const data = await res.json();
    activeLocale = detectLocale(data);
    translations = data[activeLocale] || data['en-us'];
  } catch (err) {
    console.warn('Locale load failed, using defaults', err);
    translations = {};
  }
  applyTranslations();
  renderLetterGrid();
}

function defaultMeetingTime() {
  const now = new Date();
  const rounded = new Date(now.getTime());
  rounded.setMinutes(0, 0, 0);
  rounded.setHours(now.getHours());
  const local = `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}`;
  const time = `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
  meetingInput.value = `${local}T${time}`;
}

function getSelectedDate() {
  if (meetingInput.value) {
    const parsed = new Date(meetingInput.value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function buildFormattedTime() {
  const selectedOffset = Number(offsetInput.value);
  const letter = offsetToLetter(selectedOffset);
  const selectedDate = getSelectedDate();
  const utcMs = selectedDate.getTime() + selectedDate.getTimezoneOffset() * 60000;
  const targetDate = new Date(utcMs + selectedOffset * 3600000);
  const formatted = `${letter}${pad(targetDate.getMinutes())}:${pad(targetDate.getSeconds())}`;
  formattedEl.textContent = formatted;

  const localLabel = `${pad(selectedDate.getHours())}:${pad(selectedDate.getMinutes())}`;
  const noteTemplate = translations.formattedNote || 'Local time: {{time}} (UTC{{offset}})';
  const baseNote = noteTemplate
    .replace('{{time}}', localLabel)
    .replace('{{offset}}', formatOffset(-selectedDate.getTimezoneOffset() / 60));
  const name = meetingNameInput.value.trim();
  formattedNoteEl.textContent = name ? `${name} — ${baseNote}` : baseNote;

  letterDisplay.textContent = letter;
  offsetDisplay.textContent = `${translations.referenceUTC || 'UTC'}${formatOffset(selectedOffset)}`;
}

function updateLocalOffsetBadge() {
  const offset = -new Date().getTimezoneOffset() / 60;
  const letter = offsetToLetter(offset);
  const template = translations.localBadge || 'Local offset: UTC{{offset}} → {{letter}}';
  localOffsetBadge.textContent = template
    .replace('{{offset}}', formatOffset(offset))
    .replace('{{letter}}', letter);
}

function syncOffsetSlider() {
  const offset = -Math.round(new Date().getTimezoneOffset() / 60);
  offsetInput.value = offset;
  letterDisplay.textContent = offsetToLetter(offset);
  offsetDisplay.textContent = `${translations.referenceUTC || 'UTC'}${formatOffset(offset)}`;
}

function initCopy() {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formattedEl.textContent.trim());
      copyBtn.textContent = translations.copySuccess || 'Copied!';
      setTimeout(() => (copyBtn.textContent = translations.copyBtn || 'Copy code'), 1600);
    } catch (err) {
      formattedNoteEl.textContent = translations.copyFail || 'Copy unavailable. Select the text above.';
    }
  });
}

function bindEvents() {
  offsetInput.addEventListener('input', buildFormattedTime);
  meetingInput.addEventListener('change', buildFormattedTime);
  meetingNameInput.addEventListener('input', buildFormattedTime);
}

(async function init() {
  defaultMeetingTime();
  await loadLocale();
  syncOffsetSlider();
  updateLocalOffsetBadge();
  buildFormattedTime();
  initCopy();
  bindEvents();
})();
