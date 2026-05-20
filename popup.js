/**
 * TL;DR — 3-Bullet Page Summary
 * Summarizes any webpage into 3 bullet points using on-device extraction.
 * No API keys, no tracking, works offline.
 */

const els = {
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  summary: document.getElementById('summary'),
  pageTitle: document.getElementById('page-title'),
  pageHost: document.getElementById('page-host'),
  bullets: document.getElementById('bullets'),
  wordCount: document.getElementById('word-count'),
  readTime: document.getElementById('read-time'),
  error: document.getElementById('error'),
  errorText: document.getElementById('error-text'),
  copyBtn: document.getElementById('copy'),
  openBtn: document.getElementById('open'),
  refreshBtn: document.getElementById('refresh'),
  historyPanel: document.getElementById('history-panel'),
  historyToggle: document.getElementById('history-toggle'),
  historyClose: document.getElementById('history-close'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  clearHistory: document.getElementById('clear-history'),
  themeToggle: document.getElementById('theme-toggle'),
  themeIcon: document.getElementById('theme-icon'),
  exportMd: document.getElementById('export-md'),
  exportTxt: document.getElementById('export-txt'),
};

let currentUrl = '';
let currentBullets = [];
const HISTORY_KEY = 'tldr-history';
const MAX_HISTORY = 50;

/* ─── Theme ─── */
function initTheme() {
  const saved = localStorage.getItem('tldr-theme');
  if (saved === 'light') {
    document.body.classList.add('light');
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('tldr-theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  if (isLight) {
    els.themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  } else {
    els.themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
  }
}

/* ─── History ─── */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryItem(data, bullets, url) {
  const history = loadHistory();
  const item = {
    timestamp: Date.now(),
    url,
    title: data.title || 'Untitled Page',
    host: data.host || '',
    bullets,
  };
  if (history.length > 0 && history[0].url === url && JSON.stringify(history[0].bullets) === JSON.stringify(bullets)) {
    history[0] = item;
  } else {
    history.unshift(item);
  }
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderHistory() {
  const history = loadHistory();
  els.historyList.innerHTML = '';
  if (history.length === 0) {
    els.historyEmpty.classList.remove('hidden');
    els.historyList.classList.add('hidden');
    return;
  }
  els.historyEmpty.classList.add('hidden');
  els.historyList.classList.remove('hidden');
  history.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="history-title">${escapeHtml(item.title)}</div>
      <div class="history-meta">
        <span>${escapeHtml(item.host)}</span>
        <span>${formatTime(item.timestamp)}</span>
      </div>
    `;
    li.addEventListener('click', () => {
      currentUrl = item.url;
      showSummary({ title: item.title, host: item.host, paragraphs: [] }, item.bullets, item.url);
      closeHistory();
    });
    els.historyList.appendChild(li);
  });
}

function openHistory() {
  renderHistory();
  els.historyPanel.classList.remove('hidden');
}

function closeHistory() {
  els.historyPanel.classList.add('hidden');
}

function clearHistoryAll() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

/* ─── Core: Extract text from the active tab ─── */
async function getPageContent() {
  // Demo mode: if not in Chrome extension, show sample data
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    currentUrl = 'https://example.com/article';
    return {
      title: 'Sample Article: The Future of AI-Powered Development',
      host: 'example.com',
      paragraphs: [
        'Artificial intelligence is revolutionizing how software is built, tested, and deployed in modern development workflows.',
        'Companies using AI coding assistants report 30-50% faster delivery times and significantly reduced bug counts.',
        'The next generation of developer tools will feature autonomous agents that can architect, code, and ship entire products.',
        'Security and ethics remain critical concerns as AI systems gain more autonomy in production environments.',
        'Early adopters of AI development pipelines are capturing market share from competitors stuck in traditional workflows.'
      ],
      metaDescription: 'AI is transforming software development with autonomous agents and intelligent assistants.',
      articleText: 'Artificial intelligence is revolutionizing how software is built. Companies report 30-50% faster delivery. The next generation features autonomous agents. Security remains critical. Early adopters capture market share.'
    };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab found');

  currentUrl = tab.url;

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Remove script/style/nav/footer/code blocks
      const clone = document.body.cloneNode(true);
      const remove = clone.querySelectorAll('script, style, nav, footer, aside, [role="navigation"]');
      remove.forEach(el => el.remove());

      // Get all paragraphs
      const paragraphs = Array.from(clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'))
        .map(el => el.innerText?.trim())
        .filter(t => t && t.length > 30 && t.split(' ').length > 5)
        .filter(t => !t.includes('cookie') && !t.includes('privacy policy'));

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

      // Get article text (if readable)
      const article = document.querySelector('article')?.innerText || '';

      return {
        title: document.title,
        host: location.hostname,
        paragraphs,
        metaDescription: metaDesc,
        articleText: article,
      };
    },
  });

  return result;
}

/* ─── Core: Summarize into 3 bullets ─── */
function summarize(data) {
  const allText = data.articleText || data.paragraphs.join(' ');
  const sentences = allText
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.split(' ').length > 4 && s.split(' ').length < 60);

  if (sentences.length === 0) {
    if (data.metaDescription) {
      return [data.metaDescription, 'No additional content available.', 'Try a content-rich page.'];
    }
    throw new Error('Not enough text on this page to summarize.');
  }

  // Score sentences by importance
  const wordFreq = {};
  const words = allText.toLowerCase().match(/\b\w{3,}\b/g) || [];
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

  // Remove common stop words
  const stopWords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','day','get','has','him','his','how','its','may','new','now','old','see','two','who','boy','did','she','use','her','way','many','oil','sit','set','run','eat','far','sea','eye','ago','off','too','any','say','man','try','ask','end','why','let','put','say','she','try','way','own','say','too','old','tell','very','when','come','here','look','long','make','call','find','give','good','hand','hold','home','keep','last','late','life','live','love','made','make','mean','meet','might','mind','miss','more','move','much','must','name','need','next','only','open','over','part','pass','past','pick','plan','play','pull','push','read','real','rest','rich','right','road','room','rule','safe','same','save','seem','send','show','side','sign','sing','slow','some','song','soon','sort','sound','stay','step','stop','such','sure','take','talk','team','tell','test','than','that','them','then','they','thin','this','time','tone','took','town','tree','turn','upon','very','view','wait','walk','wall','want','warm','warn','wash','wear','week','well','went','were','what','when','wife','will','wind','wish','with','word','work','year','your']);

  const scored = sentences.map(sentence => {
    const sWords = sentence.toLowerCase().match(/\b\w{3,}\b/g) || [];
    let score = 0;
    sWords.forEach(w => {
      if (!stopWords.has(w)) {
        score += wordFreq[w] || 0;
      }
    });
    // Boost first sentence of article
    if (data.paragraphs[0]?.includes(sentence)) score *= 1.3;
    // Boost sentences with numbers
    if (/\d+/.test(sentence)) score *= 1.1;
    // Penalize very short sentences
    score *= Math.min(sWords.length / 10, 1.5);
    return { sentence, score };
  });

  // Pick top 3 diverse sentences
  scored.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const candidate of scored) {
    if (picked.length >= 3) break;
    // Check diversity — don't pick sentences that are too similar
    const isDuplicate = picked.some(p => {
      const overlap = p.sentence.split(' ').filter(w => candidate.sentence.includes(w)).length;
      return overlap / p.sentence.split(' ').length > 0.7;
    });
    if (!isDuplicate) picked.push(candidate);
  }

  if (picked.length < 3 && data.metaDescription) {
    picked.push({ sentence: data.metaDescription });
  }

  return picked.map(p => p.sentence).slice(0, 3);
}

/* ─── UI: Render ─── */
function showLoading(msg) {
  els.status.classList.remove('hidden');
  els.summary.classList.add('hidden');
  els.error.classList.add('hidden');
  els.statusText.textContent = msg;
  els.copyBtn.disabled = true;
  els.openBtn.disabled = true;
  els.exportMd.disabled = true;
  els.exportTxt.disabled = true;
}

function showSummary(data, bullets, url) {
  els.status.classList.add('hidden');
  els.summary.classList.remove('hidden');
  els.error.classList.add('hidden');

  els.pageTitle.textContent = data.title || 'Untitled Page';
  try {
    els.pageHost.textContent = data.host || (url ? new URL(url).hostname : 'unknown');
  } catch {
    els.pageHost.textContent = data.host || 'unknown';
  }

  currentBullets = bullets;

  els.bullets.innerHTML = bullets.map(b => `
    <li>
      ${escapeHtml(b)}
      <button class="bullet-copy" title="Copy bullet" aria-label="Copy bullet">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    </li>
  `).join('');

  els.bullets.querySelectorAll('.bullet-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = btn.parentElement.childNodes[0].textContent.trim();
      await navigator.clipboard.writeText(text);
      const original = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => { btn.innerHTML = original; }, 1200);
    });
  });

  const wordCount = (data.paragraphs || []).join(' ').split(/\s+/).length;
  if (wordCount > 0) {
    els.wordCount.textContent = `${wordCount.toLocaleString()} words`;
    els.readTime.textContent = `${Math.ceil(wordCount / 200)} min read`;
  } else {
    els.wordCount.textContent = '';
    els.readTime.textContent = '';
  }

  els.copyBtn.disabled = false;
  els.openBtn.disabled = false;
  els.exportMd.disabled = false;
  els.exportTxt.disabled = false;

  if (url) {
    saveHistoryItem(data, bullets, url);
  }
}

function showError(msg) {
  els.status.classList.add('hidden');
  els.summary.classList.add('hidden');
  els.error.classList.remove('hidden');
  els.errorText.textContent = msg;
  els.copyBtn.disabled = true;
  els.openBtn.disabled = true;
  els.exportMd.disabled = true;
  els.exportTxt.disabled = true;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ─── Actions ─── */
async function run() {
  showLoading('Reading the page…');
  try {
    const data = await getPageContent();
    showLoading('Summarizing…');
    await new Promise(r => setTimeout(r, 400)); // Let UI breathe

    const bullets = summarize(data);
    showSummary(data, bullets, currentUrl);
  } catch (err) {
    showError(err.message || 'Something went wrong. Try a different page.');
  }
}

els.copyBtn.addEventListener('click', async () => {
  const text = Array.from(els.bullets.querySelectorAll('li')).map(li => `• ${li.childNodes[0].textContent.trim()}`).join('\n');
  await navigator.clipboard.writeText(text);
  const original = els.copyBtn.innerHTML;
  els.copyBtn.innerHTML = '<span>Copied!</span>';
  setTimeout(() => els.copyBtn.innerHTML = original, 1500);
});

els.openBtn.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: currentUrl });
  } else {
    window.open(currentUrl, '_blank');
  }
});

els.refreshBtn.addEventListener('click', () => run());

els.historyToggle.addEventListener('click', () => {
  if (els.historyPanel.classList.contains('hidden')) {
    openHistory();
  } else {
    closeHistory();
  }
});
els.historyClose.addEventListener('click', closeHistory);
els.clearHistory.addEventListener('click', clearHistoryAll);

els.themeToggle.addEventListener('click', toggleTheme);

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

els.exportMd.addEventListener('click', () => {
  const title = els.pageTitle.textContent || 'Summary';
  const host = els.pageHost.textContent || '';
  let md = `# ${title}\n`;
  if (host) md += `> ${host}\n\n`;
  md += currentBullets.map(b => `- ${b}`).join('\n') + '\n';
  const safeName = title.slice(0, 40).replace(/\s+/g, '_').replace(/[^\w_-]/g, '');
  downloadFile(md, `${safeName}_summary.md`, 'text/markdown');
});

els.exportTxt.addEventListener('click', () => {
  const title = els.pageTitle.textContent || 'Summary';
  const host = els.pageHost.textContent || '';
  let txt = `${title}\n${host ? host + '\n' : ''}\n`;
  txt += currentBullets.map(b => `• ${b}`).join('\n') + '\n';
  const safeName = title.slice(0, 40).replace(/\s+/g, '_').replace(/[^\w_-]/g, '');
  downloadFile(txt, `${safeName}_summary.txt`, 'text/plain');
});

// Auto-run on open
run();
initTheme();
