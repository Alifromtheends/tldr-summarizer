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
};

let currentUrl = '';

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

  els.bullets.innerHTML = bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('');

  const wordCount = data.paragraphs.join(' ').split(/\s+/).length;
  els.wordCount.textContent = `${wordCount.toLocaleString()} words`;
  els.readTime.textContent = `${Math.ceil(wordCount / 200)} min read`;

  els.copyBtn.disabled = false;
  els.openBtn.disabled = false;
}

function showError(msg) {
  els.status.classList.add('hidden');
  els.summary.classList.add('hidden');
  els.error.classList.remove('hidden');
  els.errorText.textContent = msg;
  els.copyBtn.disabled = true;
  els.openBtn.disabled = true;
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
  const text = Array.from(els.bullets.querySelectorAll('li')).map(li => `• ${li.textContent}`).join('\n');
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

// Auto-run on open
run();
