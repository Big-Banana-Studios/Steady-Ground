/* Steady Ground — a learning partner that runs on the child's own device.

   The shape mirrors Writer's Flow: a worker holds the model, the page holds ten
   tabs, and nothing is sent anywhere. The differences are all about who is
   sitting in front of it.

   What is deliberately different from Writer's Flow:

   - Model text is never drawn as it arrives. It is checked in full first
     (see safety.js). A calm breathing dot covers the wait instead.
   - Nothing a child types or receives is written to disk. localStorage holds
     four things, all of them settings: whether the guidebook has been seen,
     the theme, the text size, and whether the model has been downloaded before.
     Inputs and outputs live in a plain object and die with the tab.
   - A response that fails a coherence check is retried once, quietly, at a
     lower temperature. A small model garbles maybe one answer in ten, and a
     child who sees "I got turned around" twice concludes the app is broken —
     usually correctly, and usually fixable by asking again. */

'use strict';

import {
  TABS, TAB_BY_ID, buildSystem,
  DID_THE_WORK_CORRECTION, FORMAT_CORRECTION, OFF_TOPIC_CORRECTION, FOOD_CORRECTION,
} from './prompts.js';
import {
  checkInput, checkOutput, capLength, scrub, trimDeadEnd, trimTangent, fallback,
  mentionsBelief, CARE_CARD, CALM_FALLBACK, ACTIVITIES_FALLBACK,
  DID_THE_WORK_MESSAGE, MAX_INPUT_CHARS,
} from './safety.js';
import { createGuidebook, hasSeenGuidebook } from './guidebook.js';

// Bump on every deploy, and keep APP_VERSION identical to VERSION in sw.js.
const APP_VERSION = 'v1.3.5';
const VERSION_DATE = 'Aug 2026';

const MODEL_MB = 814;                    // measured from the Hugging Face CDN
const CACHED_FLAG = 'sg-model-cached';
const THEME_KEY = 'sg-theme';
const TEXT_SIZE_KEY = 'sg-text-size';

/* Signs that the GPU gave out rather than the code being wrong. Chrome reports
   a lost WebGPU device as a failure to build a compute pipeline, so the message
   names the pipeline and not the memory. */
const GPU_LOST = /Instance reference no longer exists|device.*lost|compute pipeline|OrtRun/i;

/* Two different ways an answer can be the wrong shape, and they need different
   things said to the model on the retry.

   DOING_THE_WORK: it answered with the child's homework, or with facts about the
   topic where steps were asked for — which is the same mistake wearing numbers.
   WRONG_SHAPE: it simply ignored the format it was given. */
const DOING_THE_WORK = new Set(['did-the-work', 'not-steps', 'no-list']);
const WRONG_SHAPE = new Set(['no-list', 'not-questions', 'no-sections']);

/* Untidy, not unusable. A "Why Does This Matter?" answer without its bold
   headings is still a perfectly good answer, and a child who typed "science"
   and got "I work best with school questions!" has been told they did something
   wrong when they did not. Worth one retry for tidiness; never worth throwing
   the answer away. */
const COSMETIC = new Set(['no-sections', 'not-questions']);

const $ = (id) => document.getElementById(id);

const el = {
  tabs: $('tabs'), panel: $('panel'), tabTitle: $('tabTitle'), tabDesc: $('tabDesc'),
  input: $('input'), counter: $('counter'), submitBtn: $('submitBtn'), clearBtn: $('clearBtn'),
  outputCard: $('outputCard'), output: $('output'), outputTools: $('outputTools'),
  copyBtn: $('copyBtn'), speakBtn: $('speakBtn'), printBtn: $('printBtn'), reportBtn: $('reportBtn'),
  followUps: $('followUps'), nextTip: $('nextTip'), finePrint: $('finePrint'),
  status: $('status'), statusText: $('statusText'),
  themeToggle: $('themeToggle'), textSizeBtn: $('textSizeBtn'),
  guideBtn: $('guideBtn'), parentsBtn: $('parentsBtn'),
  menuToggle: $('menuToggle'), sidebar: $('sidebar'), scrim: $('scrim'),
  toast: $('toast'), version: $('version'),
  gate: $('gate'), gateTitle: $('gateTitle'), gateBody: $('gateBody'), gateAction: $('gateAction'),
  bar: $('bar'), barFill: $('barFill'), barLabel: $('barLabel'),
  guidebook: $('guidebook'), parents: $('parents'), parentsClose: $('parentsClose'),
};

/* Session state. Deliberately a plain object with no persistence anywhere near
   it: close the tab and every word a child wrote is gone. */
const state = {};
TABS.forEach((t) => {
  // fromModel decides whether the "I get things wrong" line belongs under it.
  state[t.id] = { input: '', output: '', care: false, fromModel: false };
});

let activeTab = TABS[0].id;
let isLoading = false;
let modelReady = false;
let requestId = 0;
let pendingTab = null;
let pendingRun = null;          // { input, variant, empty, retried }
let supportAnswer = null;       // held while the guidebook is up
let guidebook = null;
const fileProgress = new Map();

const worker = new Worker('./worker.js', { type: 'module' });

/* If the worker dies before it can answer — a failed import, an old browser, no
   network — there is no message to react to, and without this the app sits on
   "Checking…" forever looking like it is still working. */
let answered = false;

function workerFailed(detail) {
  if (answered) return;
  answered = true;
  el.status.className = 'status is-error';
  el.statusText.textContent = "Couldn't start";
  showGate(
    "The app couldn't start",
    'The part that runs the helper failed to load.<br><br>'
    + `<code class="detail">${escapeHtml(detail)}</code><br><br>`
    + 'If you are offline, connect to wifi and reload the page.',
    'Reload', () => window.location.reload(),
  );
}

worker.addEventListener('error', (e) => {
  console.error('worker error', e);
  workerFailed(e.message || 'The worker script failed to load.');
});
worker.addEventListener('messageerror', () => workerFailed('The worker sent something unreadable.'));
window.setTimeout(() => {
  workerFailed('Timed out waiting for the graphics check. The model library may have failed to load.');
}, 25000);

/* ------------------------------------------------------------- rendering */

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* Single asterisks become bold-and-coloured rather than italic. The brief is
   right about this: italics are measurably harder for a lot of dyslexic and
   autistic readers, and emphasis is the only thing the model means by them. */
function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<b class="emph">$2</b>')
    .replace(/`([^`\n]+)`/g, '<b class="emph">$1</b>');
}

// Escapes first, then formats, so nothing the model writes can become markup.
function renderMarkdown(raw) {
  const lines = escapeHtml(raw).split('\n');
  const html = [];
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) { html.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; }
  };
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  const openList = (kind) => {
    if (list !== kind) { closeList(); html.push(`<${kind}>`); list = kind; }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); closeList(); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph(); closeList(); html.push('<hr>'); continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { flushParagraph(); closeList(); html.push(`<h3>${inline(heading[2])}</h3>`); continue; }

    const boldOnly = trimmed.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) { flushParagraph(); closeList(); html.push(`<h3>${inline(boldOnly[1])}</h3>`); continue; }

    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) { flushParagraph(); openList('ol'); html.push(`<li>${inline(ordered[1])}</li>`); continue; }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) { flushParagraph(); openList('ul'); html.push(`<li>${inline(bullet[1])}</li>`); continue; }

    closeList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

/* ------------------------------------------------------------------ tabs */

const currentTab = () => TAB_BY_ID[activeTab];

function buildTabs() {
  TABS.forEach((tab) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.type = 'button';
    btn.dataset.tab = tab.id;
    btn.innerHTML = `<span class="tab-icon" aria-hidden="true">${tab.icon}</span><span></span>`;
    btn.lastElementChild.textContent = tab.label;
    btn.addEventListener('click', () => selectTab(tab.id));
    el.tabs.appendChild(btn);
  });
}

function selectTab(id) {
  if (id === activeTab) { closeSidebar(); return; }
  saveInput();
  stopSpeaking();
  el.panel.classList.add('is-switching');
  window.setTimeout(() => {
    activeTab = id;
    renderTab();
    el.panel.classList.remove('is-switching');
  }, 140);
  closeSidebar();
}

function renderTab() {
  const tab = currentTab();
  const data = state[activeTab];

  document.querySelectorAll('.tab').forEach((btn) => {
    const on = btn.dataset.tab === activeTab;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-current', on ? 'page' : 'false');
  });

  el.tabTitle.textContent = tab.title;
  el.tabDesc.textContent = tab.desc;
  el.input.placeholder = tab.placeholder;
  el.input.value = data.input;
  el.input.classList.remove('nudge');
  el.submitBtn.textContent = tab.button;

  updateCounter();
  if (data.care) showCareCard();
  else if (isLoading && pendingTab === activeTab) showLoading();
  else renderOutput(data.output, data.fromModel);

  // Reflect the in-flight state, don't overwrite it: an answer being written
  // for another tab is still being written, and the worker can only do one at
  // a time. Calling setLoading here would clear that flag and let a second
  // request start on top of the first.
  syncSubmit();
}

function renderOutput(text, fromModel = true) {
  if (!text) {
    el.outputCard.hidden = true;
    el.output.innerHTML = '';
    el.finePrint.hidden = true;
    el.followUps.hidden = true;
    el.nextTip.hidden = true;
    return;
  }
  el.outputCard.hidden = false;
  el.outputCard.classList.remove('is-care');
  el.output.innerHTML = renderMarkdown(text);
  el.outputTools.hidden = false;
  el.finePrint.hidden = !fromModel;
  renderFollowUps();
}

/* The two "Simpler Please" style buttons, plus the gentle cross-tab nudge. Both
   only appear once there is something to be simpler than. */
function renderFollowUps() {
  const tab = currentTab();
  el.followUps.innerHTML = '';

  if (tab.variants) {
    /* Written here rather than asked of the model, so it says the same true
       thing every time and points at buttons that actually exist. It also
       makes the buttons findable — a child who has just been told something
       still doesn't make sense won't go hunting for a control. */
    const hint = document.createElement('p');
    hint.className = 'follow-hint';
    hint.textContent = 'Still confusing? Press one of these for a simpler answer.';
    el.followUps.appendChild(hint);

    tab.variants.forEach((variant) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-soft';
      btn.textContent = variant.label;
      btn.disabled = isLoading;
      btn.addEventListener('click', () => run({ variant }));
      el.followUps.appendChild(btn);
    });
    el.followUps.hidden = false;
  } else {
    el.followUps.hidden = true;
  }

  if (tab.nextTip) {
    el.nextTip.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tip';
    btn.innerHTML = `<span aria-hidden="true">💭</span> ${escapeHtml(tab.nextTip.text)}`;
    btn.addEventListener('click', () => selectTab(tab.nextTip.tab));
    el.nextTip.appendChild(btn);
    el.nextTip.hidden = false;
  } else {
    el.nextTip.hidden = true;
  }
}

/* Distress response. Hardcoded, never model-generated, and styled differently
   from an ordinary answer so it reads as somebody meaning it. */
function showCareCard() {
  el.outputCard.hidden = false;
  el.outputCard.classList.add('is-care');
  el.outputTools.hidden = true;
  el.finePrint.hidden = true;
  el.followUps.hidden = true;
  el.nextTip.hidden = true;
  el.output.innerHTML =
    `<div class="care-mark" aria-hidden="true">🌿</div>`
    + `<h3 class="care-title">${escapeHtml(CARE_CARD.title)}</h3>`
    + renderMarkdown(CARE_CARD.body);
  el.outputCard.focus();
}

function showNotice(message) {
  el.outputCard.hidden = false;
  el.outputCard.classList.remove('is-care');
  el.outputTools.hidden = true;
  el.finePrint.hidden = true;
  el.followUps.hidden = true;
  el.nextTip.hidden = true;
  el.output.innerHTML = `<p class="notice">${escapeHtml(message)}</p>`;
}

function showLoading(second = false) {
  el.outputCard.hidden = false;
  el.outputCard.classList.remove('is-care');
  el.outputTools.hidden = true;
  el.finePrint.hidden = true;
  el.followUps.hidden = true;
  el.nextTip.hidden = true;
  el.output.innerHTML =
    '<div class="loading"><span class="pulse" aria-hidden="true"></span>'
    + `<span id="loadingText">${second ? 'Let me try that again…' : 'Thinking it through…'}</span></div>`;
}

// Paints the buttons from whatever the current state happens to be.
function syncSubmit() {
  el.submitBtn.disabled = isLoading || !modelReady;
  el.submitBtn.textContent = isLoading ? 'Thinking…' : currentTab().button;
  [...el.followUps.querySelectorAll('button')].forEach((b) => { b.disabled = isLoading; });
}

function setLoading(loading) {
  isLoading = loading;
  syncSubmit();
}

function updateCounter() {
  const text = el.input.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  el.counter.textContent =
    `${words} ${words === 1 ? 'word' : 'words'} · ${text.length} of ${MAX_INPUT_CHARS} characters`;
  el.counter.classList.toggle('is-full', text.length >= MAX_INPUT_CHARS);
}

const saveInput = () => { state[activeTab].input = el.input.value; };

/* ------------------------------------------------------------ generation */

function run({ variant = null } = {}) {
  if (isLoading || !modelReady) return;

  const tab = currentTab();
  saveInput();
  const text = el.input.value.trim();
  const empty = !text;

  if (empty && !tab.allowEmpty) {
    el.input.classList.remove('nudge');
    void el.input.offsetWidth;                 // restart the animation
    el.input.classList.add('nudge');
    el.input.focus();
    return;
  }

  // Layer 2. Nothing goes to the model until this has had a look at it.
  if (!empty) {
    // Break It Down is the one tab where "write an essay on X" is the right
    // thing to type: it is the assignment, and turning it into steps is the job.
    const problem = checkInput(text, { allowAssignment: tab.listKind === 'steps' });
    if (problem) {
      state[activeTab].output = '';
      if (problem.kind === 'crisis') {
        state[activeTab].care = true;
        showCareCard();
      } else {
        state[activeTab].care = false;
        showNotice(problem.message);
      }
      return;
    }
  }

  state[activeTab].care = false;
  state[activeTab].output = '';
  pendingTab = activeTab;
  pendingRun = {
    input: empty ? tab.emptyInput : text,
    shown: empty ? '' : text,
    variant,
    empty,
    retried: false,
    correction: null,
    // Costs a paragraph of system prompt, so it is only added for the topics
    // that need it — see BELIEF_RULE.
    beliefs: mentionsBelief(empty ? '' : text),
  };
  requestId += 1;

  stopSpeaking();
  setLoading(true);
  showLoading(false);
  send();
}

function send() {
  const tab = TAB_BY_ID[pendingTab];
  worker.postMessage({
    type: 'generate',
    id: requestId,
    system: buildSystem(tab, {
      variant: pendingRun.variant,
      empty: pendingRun.empty,
      correction: pendingRun.correction,
      beliefs: pendingRun.beliefs,
    }),
    input: pendingRun.input,
    maxTokens: tab.maxTokens,
    prefill: tab.prefill || '',
    /* Cool by default and cooler still on a retry. Writer's Flow runs at 0.7
       because an adult writing an essay wants surprising word choices; a child
       being told what a fraction is wants the same answer every time. Most of
       the waffle in testing came from the model being freer than it needed. */
    temperature: pendingRun.retried ? 0.3 : 0.45,
  });
}

/* Layers 3 and 5. Everything the model produced arrives here in one piece and
   has to get past all of it before a single character is drawn. */
function finish(raw) {
  const tabId = pendingTab;
  const tab = TAB_BY_ID[tabId];
  // Scrub invented links, then cut any "want me to...?" sign-off, since there
  // is nowhere for the child to say yes.
  /* Only Find the Stuck keeps its questions now — a numbered list of them is
     the entire deliverable there.

     Calm Corner used to be exempt too, to protect "what can you hear?". Its
     prompt now asks for instructions instead ("listen for the quietest sound in
     the room"), because a child in overwhelm has run out of room to make
     decisions and every question is one more thing to work out. With the
     questions gone from the exercise, a question at the end is a dead end like
     anywhere else. */
  const keepQuestions = tab.listKind === 'questions';
  const cleaned = trimTangent(
    trimDeadEnd(scrub(String(raw || '')), {
      gentle: keepQuestions,
      // Calm Corner's exercise is instructions now, so a question is a defect.
      noQuestions: !!tab.calm,
    }),
    // The feelings tabs are the two places a "tell someone at home" line belongs.
    { allow: !!tab.allowEmpty },
  );
  const reason = checkOutput(cleaned, {
    input: pendingRun.shown,
    calm: !!tab.calm,
    activities: !!tab.activities,
    listKind: tab.listKind || null,
    sections: tab.sections || null,
    // Calm Corner and What Can I Try are exempt: a feeling is properly answered
    // in different words than the child used for it.
    topic: !tab.allowEmpty,
  });

  if (reason) {
    console.warn(`[safety] output rejected: ${reason}`);

    // Worth one more go, but only if the second attempt is told what it got
    // wrong — and told precisely one thing, which this model handles far better
    // than a longer, sterner version of the original instruction.
    const didTheWork = DOING_THE_WORK.has(reason);
    const wrongShape = WRONG_SHAPE.has(reason);

    // Garbled is worth another go; unsafe is not. Poking a model that just
    // produced something it shouldn't have tends to produce it again.
    const unsafe = reason.startsWith('content:');

    if (!unsafe && !pendingRun.retried) {
      pendingRun.retried = true;
      if (didTheWork) pendingRun.correction = DID_THE_WORK_CORRECTION;
      else if (wrongShape) pendingRun.correction = FORMAT_CORRECTION;
      else if (reason === 'food-advice') pendingRun.correction = FOOD_CORRECTION;
      else if (reason === 'off-topic') {
        pendingRun.correction = OFF_TOPIC_CORRECTION.replaceAll('{topic}', pendingRun.shown);
      }
      requestId += 1;
      if (activeTab === tabId) showLoading(true);
      send();
      return;
    }

    /* The retry did not fix it either. If the only complaint was the shape,
       show the answer regardless — it is untidy, not unsafe, and something
       imperfect beats an apology for a question that was perfectly good. */
    if (COSMETIC.has(reason)) {
      state[tabId].output = capLength(cleaned, tab.maxChars);
      state[tabId].fromModel = true;
      if (activeTab === tabId) renderOutput(state[tabId].output, true);
      setLoading(false);
      return;
    }

    /* Say what actually happened. A child who asked for steps and got an essay
       should not be told "hmm, I got a little turned around" — that is a fib,
       and it teaches them the app is unreliable rather than that it has a line
       it won't cross. */
    /* Calm Corner never gets an apology. A child who came here overwhelmed
       and is handed "that didn't come out right" has been let down at the worst
       possible moment — so they get a real exercise instead, written by people. */
    if (tab.calm) state[tabId].output = CALM_FALLBACK;
    else if (tab.activities) state[tabId].output = ACTIVITIES_FALLBACK;
    else state[tabId].output = didTheWork ? DID_THE_WORK_MESSAGE : fallback();
    state[tabId].fromModel = false;
    if (activeTab === tabId) {
      renderOutput(state[tabId].output, false);
      el.outputTools.hidden = true;
      el.followUps.hidden = true;
    }
    setLoading(false);
    return;
  }

  state[tabId].output = capLength(cleaned, tab.maxChars);
  state[tabId].fromModel = true;
  if (activeTab === tabId) renderOutput(state[tabId].output, true);
  setLoading(false);
}

/* ---------------------------------------------------------------- model */

function showGate(title, body, actionLabel, onAction) {
  el.gate.hidden = false;
  el.gateTitle.textContent = title;
  el.gateBody.innerHTML = body;
  if (actionLabel) {
    el.gateAction.hidden = false;
    el.gateAction.textContent = actionLabel;
    el.gateAction.onclick = onAction;
  } else {
    el.gateAction.hidden = true;
  }
}

const hideGate = () => { el.gate.hidden = true; el.bar.hidden = true; };

function startDownload() {
  fileProgress.clear();
  el.gateAction.hidden = true;
  el.bar.hidden = false;
  el.barLabel.textContent = 'Starting…';
  el.gateTitle.textContent = 'Getting the helper ready';
  el.gateBody.innerHTML =
    'This happens once. Keep this page open while it finishes — '
    + 'after that it stays on this device and works with no internet at all.';
  worker.postMessage({ type: 'load' });
}

function renderProgress() {
  let loaded = 0;
  let total = 0;
  fileProgress.forEach((f) => { loaded += f.loaded; total += f.total; });
  if (!total) return;
  const pct = Math.min(100, (loaded / total) * 100);
  el.barFill.style.width = `${pct.toFixed(1)}%`;
  el.barLabel.textContent =
    `${(loaded / 1048576).toFixed(0)} MB of about ${MODEL_MB} MB · ${pct.toFixed(0)}%`;
}

/* Held back while the guidebook is on screen: a child reading "hi there" should
   not have a download prompt slide in underneath them. */
function applySupport(msg) {
  if (guidebook && guidebook.isOpen) { supportAnswer = msg; return; }
  supportAnswer = null;

  if (msg.ok) {
    let cached = false;
    try { cached = !!localStorage.getItem(CACHED_FLAG); } catch { /* private mode */ }

    if (cached) {
      showGate('Waking up the helper', 'Reading it back from this device. No download needed.', null);
      el.bar.hidden = false;
      el.barLabel.textContent = 'Loading…';
      worker.postMessage({ type: 'load' });
    } else {
      showGate(
        'One download to go',
        'Steady Ground needs to fetch its helper — about '
        + `<strong>${MODEL_MB} MB</strong>, once. After that it lives on this device `
        + 'and works with no internet.<br><br>'
        + '<strong>Use wifi, not mobile data.</strong> It can take a few minutes.',
        'Get it ready', startDownload,
      );
    }
  } else {
    /* The child reads the first sentence and nothing else, so it has to be the
       one that tells them what to do. The graphics system's own words go
       underneath, quietly, for whichever adult ends up trying to fix it —
       "no-adapter" is not something to put in front of a ten-year-old as the
       explanation for why their homework helper won't open. */
    showGate(
      "This device can't run Steady Ground",
      'This app needs a newer browser to run. Try opening it in Chrome or Edge '
      + 'on a computer, or on a newer phone or tablet.'
      + (msg.reason && msg.reason !== 'no-webgpu'
        ? `<br><br>For a grown-up: <code class="detail">${escapeHtml(msg.reason)}</code>`
        : ''),
      null,
    );
    el.statusText.textContent = 'Not supported';
    el.status.className = 'status is-error';
  }
}

worker.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'support' || msg.type === 'error') answered = true;

  switch (msg.type) {
    case 'support':
      applySupport(msg);
      break;

    case 'load-start':
      el.statusText.textContent = 'Getting ready…';
      break;

    case 'load-progress':
      fileProgress.set(msg.file, { loaded: msg.loaded, total: msg.total });
      renderProgress();
      break;

    case 'load-file-done':
      if (fileProgress.has(msg.file)) {
        const f = fileProgress.get(msg.file);
        fileProgress.set(msg.file, { loaded: f.total, total: f.total });
        renderProgress();
      }
      break;

    case 'ready':
      modelReady = true;
      try { localStorage.setItem(CACHED_FLAG, '1'); } catch { /* private mode */ }
      hideGate();
      el.status.className = 'status is-ok';
      el.statusText.textContent = 'Ready · works offline';
      setLoading(false);
      break;

    // Only ever a character count — see the note at the top of worker.js.
    case 'tick': {
      if (msg.id !== requestId || activeTab !== pendingTab) break;
      const label = $('loadingText');
      if (label && msg.chars > 120) label.textContent = 'Writing it out…';
      break;
    }

    case 'done':
      if (msg.id !== requestId) break;
      finish(msg.output);
      break;

    case 'error':
      console.error(msg);
      if (!modelReady) {
        showGate(
          'The helper had trouble waking up',
          `${escapeHtml(msg.message || 'Unknown problem.')}<br><br>`
          + 'Check your wifi and try again.',
          'Try again', startDownload,
        );
      } else if (GPU_LOST.test(msg.message || '')) {
        showNotice(
          'This device ran out of room to think. Try closing some other tabs '
          + 'or apps, then ask again.',
        );
      } else {
        showNotice('Oops — something got tangled. Try again in a moment.');
      }
      setLoading(false);
      break;
  }
});

/* --------------------------------------------------------------- extras */

function clearAll() {
  // Only stops the run if it belongs to this tab — clearing one tab should not
  // quietly cancel an answer being written for another.
  if (isLoading && pendingTab === activeTab) {
    worker.postMessage({ type: 'stop' });
    requestId += 1;                      // orphan the in-flight answer
    setLoading(false);
  }
  stopSpeaking();
  const data = state[activeTab];
  data.input = '';
  data.output = '';
  data.care = false;
  data.fromModel = false;
  el.input.value = '';
  el.input.classList.remove('nudge');
  updateCounter();
  renderOutput('');
  el.input.focus();
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('is-visible');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => el.toast.classList.remove('is-visible'), 2200);
}

async function copyText(text, note) {
  try {
    await navigator.clipboard.writeText(text);
    toast(note);
  } catch {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    document.execCommand('copy');
    scratch.remove();
    toast(note);
  }
}

/* Read aloud. A lot of kids who bounce off a paragraph will take it in fine
   through their ears, so this is worth the twenty lines. */
let speaking = false;

function stopSpeaking() {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  speaking = false;
  el.speakBtn.textContent = '🔊 Read aloud';
  el.speakBtn.setAttribute('aria-pressed', 'false');
}

function toggleSpeech() {
  if (!('speechSynthesis' in window)) { toast('This browser can’t read aloud'); return; }
  if (speaking) { stopSpeaking(); return; }

  const text = state[activeTab].output;
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
  utterance.rate = 0.95;                  // a shade slower than default
  utterance.pitch = 1;
  utterance.onend = stopSpeaking;
  utterance.onerror = stopSpeaking;
  window.speechSynthesis.speak(utterance);

  speaking = true;
  el.speakBtn.textContent = '⏹ Stop';
  el.speakBtn.setAttribute('aria-pressed', 'true');
}

/* "Something went wrong here" — puts the exchange on the clipboard so a parent
   can look at it. It is not saved, uploaded or counted anywhere; the clipboard
   is the whole mechanism, on purpose. */
function reportProblem() {
  const tab = currentTab();
  const report = [
    'Steady Ground — something looked wrong',
    `App version: ${APP_VERSION} · ${VERSION_DATE}`,
    `Tab: ${tab.title}`,
    '',
    'What was typed in:',
    state[activeTab].input || '(nothing)',
    '',
    'What came back:',
    state[activeTab].output || '(nothing)',
    '',
    'Nothing here has been saved or sent anywhere — this text only exists on the clipboard.',
  ].join('\n');
  copyText(report, 'Copied — you can paste it to show a grown-up');
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el.themeToggle.textContent = theme === 'dark' ? '☀️ Day mode' : '🌙 Night mode';
  el.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
}

const TEXT_SIZES = ['normal', 'large', 'largest'];

function setTextSize(size) {
  document.documentElement.dataset.text = size;
  el.textSizeBtn.textContent = `🔠 Text size: ${size}`;
  try { localStorage.setItem(TEXT_SIZE_KEY, size); } catch { /* private mode */ }
}

/* Version readout.

   APP_VERSION on its own would be misleading, and misleading in exactly the
   situation this indicator exists to catch: app.js is fetched network-first, so
   it reports the newest version even while a stale service worker is still
   handing out old cached files. So we also ask the worker in control what
   version *it* is, and say so when they disagree. */

function askWorkerVersion() {
  const controller = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!controller) return Promise.resolve(null);

  return new Promise((done) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => done((e.data && e.data.version) || null);
    // An old worker predating this feature never replies, which is itself the
    // answer: it is stale.
    window.setTimeout(() => done(null), 2500);
    controller.postMessage({ type: 'version' }, [channel.port2]);
  });
}

async function showVersion() {
  el.version.textContent = `${APP_VERSION} · ${VERSION_DATE}`;
  el.version.className = 'version';

  if (!('serviceWorker' in navigator)) return;

  const cached = await askWorkerVersion();
  if (!cached) return;                       // normal on a first visit

  if (cached === APP_VERSION) {
    el.version.textContent = `${APP_VERSION} · ${VERSION_DATE} · up to date`;
    el.version.classList.add('is-ok');
  } else {
    el.version.textContent = `${APP_VERSION} · cache ${cached} — reload`;
    el.version.classList.add('is-stale');
    el.version.title = `This page is ${APP_VERSION} but the cache serving it is ${cached}. `
      + 'Reload once more to pick up the new version.';
  }
}

function openSidebar() {
  el.sidebar.classList.add('is-open');
  el.scrim.hidden = false;
  el.menuToggle.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  el.sidebar.classList.remove('is-open');
  el.scrim.hidden = true;
  el.menuToggle.setAttribute('aria-expanded', 'false');
}

function openParents() {
  el.parents.hidden = false;
  document.body.classList.add('is-locked');
  el.parentsClose.focus();
}

function closeParents() {
  el.parents.hidden = true;
  document.body.classList.remove('is-locked');
  el.parentsBtn.focus();
}

/* ------------------------------------------------------------------ init */

function init() {
  buildTabs();
  renderTab();
  setLoading(false);

  showVersion();

  el.submitBtn.addEventListener('click', () => run());
  el.clearBtn.addEventListener('click', clearAll);
  el.copyBtn.addEventListener('click', () => {
    if (state[activeTab].output) copyText(state[activeTab].output, 'Copied');
  });
  el.speakBtn.addEventListener('click', toggleSpeech);
  el.printBtn.addEventListener('click', () => window.print());
  el.reportBtn.addEventListener('click', reportProblem);

  el.input.setAttribute('maxlength', String(MAX_INPUT_CHARS));
  el.input.addEventListener('input', () => { updateCounter(); saveInput(); });
  el.input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });

  el.themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  el.textSizeBtn.addEventListener('click', () => {
    const now = document.documentElement.dataset.text || 'normal';
    setTextSize(TEXT_SIZES[(TEXT_SIZES.indexOf(now) + 1) % TEXT_SIZES.length]);
  });

  el.menuToggle.addEventListener('click', () => {
    if (el.sidebar.classList.contains('is-open')) closeSidebar(); else openSidebar();
  });
  el.scrim.addEventListener('click', closeSidebar);

  el.parentsBtn.addEventListener('click', openParents);
  el.parentsClose.addEventListener('click', closeParents);
  el.parents.addEventListener('click', (e) => { if (e.target === el.parents) closeParents(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.parents.hidden) closeParents();
  });

  window.addEventListener('pagehide', stopSpeaking);

  let storedTheme = null;
  let storedText = null;
  try {
    storedTheme = localStorage.getItem(THEME_KEY);
    storedText = localStorage.getItem(TEXT_SIZE_KEY);
  } catch { /* private mode */ }
  setTheme(storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  setTextSize(TEXT_SIZES.includes(storedText) ? storedText : 'normal');

  guidebook = createGuidebook({
    root: el.guidebook,
    onClose: () => {
      // Whatever the device check answered while they were reading, deal with
      // it now — including "this device can't run it".
      if (supportAnswer) applySupport(supportAnswer);
      el.gate.classList.remove('is-hushed');
    },
  });
  el.guideBtn.addEventListener('click', () => guidebook.show({ fromStart: true }));

  if (!hasSeenGuidebook()) {
    el.gate.classList.add('is-hushed');     // keep the gate quiet underneath
    guidebook.show({ fromStart: true });
  }

  worker.postMessage({ type: 'check' });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => reg.update())          // check for a new worker on every open
      .catch((e) => console.warn('Service worker not registered:', e));

    // Fires when a newly installed worker takes over, so the readout corrects
    // itself without needing another manual reload.
    navigator.serviceWorker.addEventListener('controllerchange', showVersion);
  }
}

document.addEventListener('DOMContentLoaded', init);
