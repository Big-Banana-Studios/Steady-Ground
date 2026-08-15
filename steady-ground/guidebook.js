/* The welcome guidebook — the first thing a child sees, once.

   Seven cards, one idea each. The only thing it writes down is a flag saying it
   has been seen; it never records anything about the child. It can be reopened
   any time from "How This Works" in the sidebar, which matters more than it
   sounds: a kid who skipped it on day one often wants it on day three, and
   having to ask an adult to reset something is a reason not to bother. */

const SEEN_KEY = 'steadyGround_welcomed';

const CARDS = [
  {
    emoji: '🌍',
    label: 'Welcome',
    heading: 'Hi there!',
    lines: [
      'This is Steady Ground —',
      'your learning helper.',
      '',
      'Let me show you how it works.',
      "It'll only take a minute!",
    ],
    next: 'Next →',
  },
  {
    emoji: '🎯',
    label: 'What this app does',
    lines: [
      'This app helps you understand',
      'your schoolwork better.',
      '',
      'You type something in.',
      'It helps you make sense of it.',
      '',
      "That's it!",
    ],
    next: 'Next →',
  },
  {
    emoji: '🚫📝',
    label: "It doesn't do your homework",
    heading: 'One important thing —',
    lines: [
      'This app helps you UNDERSTAND,',
      "but it won't do your work for you.",
      '',
      'You still write your own answers.',
      'You still do your own thinking.',
      'This just helps it click. ✨',
    ],
    next: 'Next →',
  },
  {
    emoji: '👈',
    label: 'The tabs',
    heading: 'See those buttons on the side?',
    lines: ['Each one does something different.'],
    // Rendered as a proper list so a screen reader reads it as one.
    list: [
      ['💡', 'Explain This', 'makes confusing stuff simple'],
      ['🤔', 'Why Does This Matter', "shows why you're learning it"],
      ['🪜', 'Break It Down', 'turns big tasks into small steps'],
      ['🔄', 'Different Way', 'explains it a new way'],
      ['🎯', 'Key Points', 'finds the important parts'],
      ['✅', 'Check My Thinking', "sees if you've got it right"],
      ['📚', 'Word Helper', "explains words you don't know"],
      ['🌊', 'Calm Corner', "helps when you're overwhelmed"],
      ['🧩', 'Find the Stuck', 'finds what’s confusing you'],
      ['🎨', 'What Can I Try', 'suggests things to do with a feeling'],
    ],
    footer: ["You don't need all of them!", 'Just pick the one that fits. 🙂'],
    next: 'Next →',
  },
  {
    emoji: '👣',
    label: 'How to use it',
    heading: "Here's all you do:",
    steps: [
      ['1️⃣', 'Pick a tab on the side'],
      ['2️⃣', 'Type or paste in the box'],
      ['3️⃣', 'Press the button'],
      ['4️⃣', 'Read what comes back'],
    ],
    footer: ["That's it.", 'No accounts. No grades. No pressure.'],
    next: 'Next →',
  },
  {
    emoji: '🌊',
    label: 'Calm Corner',
    heading: 'One more thing —',
    lines: [
      'If you ever feel stressed or stuck',
      "and can't even think about school,",
      '',
      'tap "Calm Corner."',
      '',
      "You don't even have to type anything.",
      'Just press the button and breathe.',
      '',
      'School can wait.',
      'You come first. 💙',
    ],
    next: "Let's Go! →",
  },
  {
    emoji: '🌍',
    label: 'Ready',
    heading: "You're all set!",
    lines: [
      'Pick a tab and try it out.',
      "There's no wrong way to start.",
    ],
    next: 'Start Using Steady Ground',
  },
];

export function hasSeenGuidebook() {
  try { return localStorage.getItem(SEEN_KEY) === 'true'; } catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* private mode */ }
}

export function createGuidebook({ root, onClose }) {
  let index = 0;
  let open = false;
  let lastFocus = null;

  root.innerHTML = `
    <div class="guide-card" role="dialog" aria-modal="true"
         aria-labelledby="guideHeading" aria-describedby="guideBody">
      <button class="guide-skip" type="button">Skip</button>
      <div class="guide-stage" id="guideStage"></div>
      <div class="guide-foot">
        <div class="guide-dots" role="tablist" aria-label="Guidebook pages"></div>
        <div class="guide-nav">
          <button class="btn-ghost guide-back" type="button">← Back</button>
          <button class="btn guide-next" type="button"></button>
        </div>
      </div>
    </div>`;

  const card = root.querySelector('.guide-card');
  const stage = root.querySelector('#guideStage');
  const dots = root.querySelector('.guide-dots');
  const backBtn = root.querySelector('.guide-back');
  const nextBtn = root.querySelector('.guide-next');
  const skipBtn = root.querySelector('.guide-skip');

  CARDS.forEach((c, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'guide-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Page ${i + 1} of ${CARDS.length}: ${c.label}`);
    dot.addEventListener('click', () => go(i, i > index ? 'next' : 'back'));
    dots.appendChild(dot);
  });

  function paint(cardData) {
    const parts = [];
    parts.push(`<div class="guide-emoji" aria-hidden="true">${cardData.emoji}</div>`);
    parts.push('<div class="guide-body" id="guideBody">');
    if (cardData.heading) {
      parts.push(`<h2 class="guide-heading" id="guideHeading">${cardData.heading}</h2>`);
    } else {
      // The dialog still needs something to be labelled by.
      parts.push(`<h2 class="visually-hidden" id="guideHeading">${cardData.label}</h2>`);
    }
    if (cardData.lines) {
      parts.push(`<p class="guide-lines">${cardData.lines.join('<br>')}</p>`);
    }
    if (cardData.list) {
      parts.push('<ul class="guide-list">');
      cardData.list.forEach(([icon, name, what]) => {
        parts.push(
          `<li><span class="guide-list-icon" aria-hidden="true">${icon}</span>`
          + `<span><strong>${name}</strong> — ${what}</span></li>`,
        );
      });
      parts.push('</ul>');
    }
    if (cardData.steps) {
      parts.push('<ol class="guide-steps">');
      cardData.steps.forEach(([icon, what]) => {
        parts.push(`<li><span aria-hidden="true">${icon}</span> ${what}</li>`);
      });
      parts.push('</ol>');
    }
    if (cardData.footer) {
      parts.push(`<p class="guide-lines guide-footer">${cardData.footer.join('<br>')}</p>`);
    }
    parts.push('</div>');
    return parts.join('');
  }

  function render(direction) {
    const data = CARDS[index];
    stage.innerHTML = paint(data);
    stage.classList.remove('slide-next', 'slide-back');
    // Reflow so the animation restarts even when moving the same way twice.
    void stage.offsetWidth;
    if (direction) stage.classList.add(direction === 'back' ? 'slide-back' : 'slide-next');

    nextBtn.textContent = data.next;
    backBtn.hidden = index === 0;
    skipBtn.hidden = index === CARDS.length - 1;

    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('is-on', i === index);
      dot.setAttribute('aria-selected', String(i === index));
    });

    card.scrollTop = 0;
  }

  function go(next, direction) {
    if (next < 0 || next >= CARDS.length) return;
    index = next;
    render(direction);
  }

  function show({ fromStart = true } = {}) {
    lastFocus = document.activeElement;
    open = true;
    index = fromStart ? 0 : index;
    root.hidden = false;
    document.body.classList.add('is-locked');
    render(null);
    // Focus the primary action: for a child on a tablet the Next button is the
    // whole interface, and for a keyboard user it is the right first stop.
    window.setTimeout(() => nextBtn.focus(), 30);
  }

  function close() {
    open = false;
    root.hidden = true;
    document.body.classList.remove('is-locked');
    markSeen();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (onClose) onClose();
  }

  nextBtn.addEventListener('click', () => {
    if (index === CARDS.length - 1) close(); else go(index + 1, 'next');
  });
  backBtn.addEventListener('click', () => go(index - 1, 'back'));
  skipBtn.addEventListener('click', close);

  root.addEventListener('keydown', (event) => {
    if (!open) return;

    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (index === CARDS.length - 1) close(); else go(index + 1, 'next');
      return;
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1, 'back'); return; }

    // Keep Tab inside the overlay — behind it is an app that is not ready yet.
    if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not([hidden])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  return { show, close, get isOpen() { return open; } };
}
