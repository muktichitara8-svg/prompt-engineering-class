/* ================================================
   LeakLens — script.js
   Plain JavaScript · No frameworks · No libraries
   ================================================ */

'use strict';

/* ────────────────────────────────────────────────
   DEMO BREACH DATA
   These are SIMULATED results used only when the
   email matches a known pattern in the demo.
   A real version would call the XposedOrNot API.
   ──────────────────────────────────────────────── */
const DEMO_BREACHES = [
  { name: 'LinkedIn',      emoji: '💼', color: '#0077b5' },
  { name: 'Adobe',         emoji: '🎨', color: '#ff0000' },
  { name: 'Canva',         emoji: '🖌️', color: '#00c4cc' },
  { name: 'Dropbox',       emoji: '📦', color: '#0061ff' },
  { name: 'MySpace',       emoji: '🎵', color: '#003591' },
  { name: 'Tumblr',        emoji: '📝', color: '#35465c' },
  { name: 'Twitter/X',     emoji: '🐦', color: '#1da1f2' },
  { name: 'Zynga',         emoji: '🎮', color: '#cf3535' },
  { name: 'Kickstarter',   emoji: '🚀', color: '#2bde73' },
  { name: 'Dailymotion',   emoji: '▶️', color: '#0066dc' },
  { name: 'Dubsmash',      emoji: '📸', color: '#ff3c5f' },
  { name: 'ShareThis',     emoji: '🔗', color: '#ff6550' },
  { name: 'Verified',      emoji: '✅', color: '#1a73e8' },
  { name: 'KiwiFarms',     emoji: '🥝', color: '#6fc33e' },
  { name: 'Houzz',         emoji: '🏠', color: '#7dcf3b' },
];

/* Simple deterministic "pick" based on email string
   so the same email always gets the same demo result */
function pickBreaches(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  /* Emails with "test" or "demo" → always breached for easy testing */
  const forceBreached = /test|demo|hack|leak/i.test(email);
  /* Emails with "safe" → never breached */
  const forceSafe     = /safe|clean|secure|notleaked/i.test(email);

  if (forceSafe) return [];

  /* Otherwise pick 0–8 breaches based on hash */
  const count = forceBreached
    ? 4 + (hash % 5)          /* 4 to 8 breaches */
    : (hash % 10 < 4 ? 0 : 1 + (hash % 6)); /* ~40% chance of safe */

  if (count === 0) return [];

  /* Shuffle deterministically using hash as seed */
  const shuffled = [...DEMO_BREACHES].sort((a, b) => {
    const ha = (hash ^ a.name.charCodeAt(0)) >>> 0;
    const hb = (hash ^ b.name.charCodeAt(0)) >>> 0;
    return ha - hb;
  });
  return shuffled.slice(0, count);
}


/* ────────────────────────────────────────────────
   NAVBAR – scroll effect & hamburger
   ──────────────────────────────────────────────── */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const mobileMenu= document.getElementById('mobileMenu');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

hamburger.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
}

/* Highlight active nav link on scroll */
const sections = document.querySelectorAll('section[id], div[id]');
const navLinks  = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navLinks.forEach(link => {
    const href = link.getAttribute('href')?.replace('#', '');
    link.classList.toggle('active', href === current);
  });
}, { passive: true });


/* ────────────────────────────────────────────────
   EMAIL VALIDATION
   ──────────────────────────────────────────────── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 4));
  return masked + '@' + domain;
}


/* ────────────────────────────────────────────────
   HERO EMAIL FORM  — handleCheck()
   ──────────────────────────────────────────────── */
const emailInput  = document.getElementById('emailInput');
const consentBox  = document.getElementById('consentBox');
const formError   = document.getElementById('formError');
const checkBtn    = document.getElementById('checkBtn');

function showFormError(msg) {
  formError.textContent = '⚠ ' + msg;
  formError.hidden = false;
  emailInput.focus();
}
function clearFormError() {
  formError.hidden = true;
  formError.textContent = '';
}

window.handleCheck = function (e) {
  e.preventDefault();
  clearFormError();

  const email = emailInput.value.trim();

  /* Validate format */
  if (!email) {
    showFormError('Please enter your email address.');
    return;
  }
  if (!isValidEmail(email)) {
    showFormError('That doesn\'t look like a valid email. Try: name@example.com');
    return;
  }
  if (!consentBox.checked) {
    showFormError('Please tick the checkbox to confirm you have read the privacy notice.');
    return;
  }

  /* All good — start scan */
  startScan(email);
};


/* ────────────────────────────────────────────────
   SCANNING ANIMATION
   ──────────────────────────────────────────────── */
const scanOverlay = document.getElementById('scanOverlay');
const scanBar     = document.getElementById('scanBar');
const scanMsg     = document.getElementById('scanMsg');

const SCAN_STEPS = [
  { pct: 12, msg: 'Connecting to breach database…'         },
  { pct: 30, msg: 'Searching 11 billion+ records…'         },
  { pct: 52, msg: 'Verifying email against known breaches…' },
  { pct: 75, msg: 'Cross-referencing breach sources…'      },
  { pct: 90, msg: 'Compiling results…'                     },
  { pct: 100,msg: 'Done! Loading your report…'             },
];

let scanCancelled = false;

function startScan(email) {
  scanCancelled = false;
  scanBar.style.width = '0%';
  scanMsg.textContent  = 'Initialising scanner…';

  /* Show overlay */
  scanOverlay.hidden = false;
  document.body.style.overflow = 'hidden';

  let stepIndex = 0;

  function runStep() {
    if (scanCancelled) return;
    if (stepIndex >= SCAN_STEPS.length) {
      /* Scan complete — show results */
      setTimeout(() => {
        if (!scanCancelled) showResults(email);
      }, 400);
      return;
    }
    const step = SCAN_STEPS[stepIndex];
    scanBar.style.width  = step.pct + '%';
    scanMsg.textContent  = step.msg;
    stepIndex++;
    /* Each step takes 600–900 ms for realism */
    setTimeout(runStep, 600 + Math.random() * 300);
  }

  setTimeout(runStep, 300);
}

window.cancelScan = function () {
  scanCancelled = true;
  hideScanOverlay();
};

function hideScanOverlay() {
  scanOverlay.hidden = true;
  document.body.style.overflow = '';
}


/* ────────────────────────────────────────────────
   RESULTS
   ──────────────────────────────────────────────── */
const resultsSection   = document.getElementById('results');
const resultHeaderCard = document.getElementById('resultHeaderCard');
const resultIcon       = document.getElementById('resultIcon');
const resultEmailBadge = document.getElementById('resultEmailBadge');
const resultTitle      = document.getElementById('resultTitle');
const resultSub        = document.getElementById('resultSub');
const resultMeta       = document.getElementById('resultMeta');
const breachListWrap   = document.getElementById('breachListWrap');
const breachGrid       = document.getElementById('breachGrid');
const breachCount      = document.getElementById('breachCount');

function showResults(email) {
  hideScanOverlay();

  const breaches   = pickBreaches(email);
  const isBreached = breaches.length > 0;
  const now        = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  /* ── Header card ── */
  resultEmailBadge.textContent = maskEmail(email);

  if (isBreached) {
    resultIcon.className = 'result-icon danger';
    resultIcon.textContent = '⚠️';
    resultTitle.className   = 'result-title danger';
    resultTitle.textContent = `Found in ${breaches.length} Breach${breaches.length > 1 ? 'es' : ''}`;
    resultSub.innerHTML =
      `Your email was matched against <strong style="color:#f87171">${breaches.length}</strong>
       simulated breach record${breaches.length > 1 ? 's' : ''}.
       Change your passwords for the services listed below immediately.<br>
       <em style="font-size:.83rem;color:var(--text-muted)">(These are demo results — not real breach data.)</em>`;
  } else {
    resultIcon.className = 'result-icon safe';
    resultIcon.textContent = '✅';
    resultTitle.className   = 'result-title safe';
    resultTitle.textContent = 'No Breaches Found (Demo)';
    resultSub.innerHTML =
      `The demo check did not match your email against any simulated breach record.
       <strong style="color:#fbbf24">This does not mean your email is safe in real life.</strong>
       Try a real breach checker like <a href="https://haveibeenpwned.com" target="_blank" rel="noopener">HaveIBeenPwned</a>
       or connect a real API for live results.`;
  }

  resultMeta.innerHTML =
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
     Checked: ${now} &nbsp;·&nbsp; Source: Demo (Simulated Data)`;

  /* ── Breach list ── */
  if (isBreached) {
    breachCount.className   = 'badge badge-danger';
    breachCount.textContent = `${breaches.length} breach${breaches.length > 1 ? 'es' : ''}`;
    breachGrid.innerHTML    = '';

    breaches.forEach((b, i) => {
      const item = document.createElement('div');
      item.className = 'breach-item';
      item.style.borderColor  = b.color + '40';
      item.style.animationDelay = (i * 60) + 'ms';

      /* Hover effect */
      item.addEventListener('mouseenter', () => {
        item.style.borderColor = b.color + '99';
        item.style.boxShadow   = `0 0 14px ${b.color}33`;
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = b.color + '40';
        item.style.boxShadow   = 'none';
      });

      item.innerHTML = `
        <div class="breach-dot" style="background:${b.color}22;border:1px solid ${b.color}44;font-size:1.1rem">
          ${b.emoji}
        </div>
        <div>
          <div class="breach-name">${escapeHtml(b.name)}</div>
          <div class="breach-label">Known data breach (demo)</div>
        </div>`;

      breachGrid.appendChild(item);
    });

    breachListWrap.hidden = false;
  } else {
    breachListWrap.hidden = true;
  }

  /* ── Show the section ── */
  resultsSection.hidden = false;

  /* Smooth scroll to results */
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* Reset to try another email */
window.resetChecker = function () {
  resultsSection.hidden   = true;
  breachListWrap.hidden   = true;
  emailInput.value        = '';
  consentBox.checked      = false;
  clearFormError();

  /* Scroll back to top */
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => emailInput.focus(), 600);
};


/* ────────────────────────────────────────────────
   LOGIN TABS
   ──────────────────────────────────────────────── */
const panelLogin  = document.getElementById('panelLogin');
const panelSignup = document.getElementById('panelSignup');
const tabLogin    = document.getElementById('tabLogin');
const tabSignup   = document.getElementById('tabSignup');
const loginSuccess= document.getElementById('loginSuccess');

window.switchTab = function (tab) {
  const isLogin = tab === 'login';
  panelLogin.hidden  = !isLogin;
  panelSignup.hidden = isLogin;
  tabLogin.classList.toggle ('active',  isLogin);
  tabSignup.classList.toggle('active', !isLogin);
  loginSuccess.hidden = true;
};

/* Handle Sign In (demo — no real auth) */
window.handleLogin = function (e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;

  if (!isValidEmail(email)) {
    alert('Please enter a valid email address.');
    return;
  }
  if (pass.length < 1) {
    alert('Please enter your password.');
    return;
  }

  /* Show success then redirect to breach check */
  panelLogin.hidden   = true;
  loginSuccess.hidden = false;

  setTimeout(() => {
    /* Pre-fill the hero email input and scroll up */
    emailInput.value = email;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      loginSuccess.hidden = false;
      panelLogin.hidden   = false;
    }, 2000);
  }, 1600);
};

/* Handle Sign Up (demo — no real registration) */
window.handleSignup = function (e) {
  e.preventDefault();
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;

  if (!name) { alert('Please enter your full name.'); return; }
  if (!isValidEmail(email)) { alert('Please enter a valid email address.'); return; }
  if (pass.length < 6) { alert('Password must be at least 6 characters.'); return; }

  /* Show success */
  panelSignup.hidden  = true;
  loginSuccess.hidden = false;

  setTimeout(() => {
    emailInput.value = email;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      loginSuccess.hidden = true;
      panelSignup.hidden  = false;
    }, 2000);
  }, 1600);
};


/* ────────────────────────────────────────────────
   PASSWORD SHOW / HIDE TOGGLE
   ──────────────────────────────────────────────── */
window.togglePass = function (inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';

  /* Swap the eye icon */
  btn.innerHTML = isText
    ? /* eye-open icon */
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>`
    : /* eye-off icon */
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`;
};


/* ────────────────────────────────────────────────
   SMOOTH SCROLL for anchor links
   ──────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const id  = this.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMobileMenu();
    const offset = 80; /* navbar height */
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


/* ────────────────────────────────────────────────
   INTERSECTION OBSERVER — fade-in on scroll
   ──────────────────────────────────────────────── */
const observerOptions = { threshold: 0.12 };

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity    = '1';
      entry.target.style.transform  = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

/* Apply initial hidden state and observe */
document.querySelectorAll(
  '.feature-card, .tip-card, .tool-item, .stat-item'
).forEach((el, i) => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(28px)';
  el.style.transition = `opacity .55s ease ${i * 60}ms, transform .55s ease ${i * 60}ms`;
  fadeObserver.observe(el);
});


/* ────────────────────────────────────────────────
   KEYBOARD ACCESSIBILITY
   ──────────────────────────────────────────────── */
/* Close mobile menu on Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMobileMenu();
    if (!scanOverlay.hidden) cancelScan();
  }
});


/* ────────────────────────────────────────────────
   UTILITY — escape HTML to prevent XSS
   ──────────────────────────────────────────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ────────────────────────────────────────────────
   INIT — run once DOM is ready
   ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Trigger scrolled state if page loads mid-scroll */
  if (window.scrollY > 20) navbar.classList.add('scrolled');

  /* Focus email input on load */
  emailInput.focus();

  console.log('%cLeakLens Demo Loaded ✅', 'color:#4f8ef7;font-weight:bold;font-size:14px');
  console.log('%cThis is a DEMO. Results are simulated. No real API is connected.', 'color:#f97316;font-size:12px');
});