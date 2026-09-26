import Lenis from 'lenis';

/* =========================================================
   0. ADAPTIVE REM GRID (scale-up above 1920)
   ========================================================= */
const FONT_BASE = 16, BASE_W = 1920, COEF = 0.6666;
function applyAdaptiveRem() {
  const html = document.documentElement;
  const reduction = ((BASE_W - window.innerWidth) / BASE_W) * 100 * COEF;
  const size = FONT_BASE - (FONT_BASE * reduction) / 100;
  if (size > FONT_BASE) html.style.fontSize = size + 'px';
  else html.style.removeProperty('font-size');
}
applyAdaptiveRem();
window.addEventListener('resize', applyAdaptiveRem);
window.scrollTo(0, 0);

/* =========================================================
   1. CONSTANTS
   ========================================================= */
const hasGSAP = typeof window.gsap !== 'undefined';
const hasST = typeof window.ScrollTrigger !== 'undefined';
if (hasGSAP && hasST) gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverable = () => window.innerWidth > 768;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =========================================================
   2. LENIS + GSAP SYNC
   ========================================================= */
const lenis = new Lenis({
  duration: 1.15,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.95,
  touchMultiplier: 1.4
});

if (hasGSAP) {
  // Single RAF loop: GSAP ticker drives Lenis
  lenis.on('scroll', () => { if (hasST) ScrollTrigger.update(); });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
} else {
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* =========================================================
   3. SCROLL LOCK
   ========================================================= */
let locked = 0;
function lockScroll() {
  locked++;
  lenis.stop();
  document.documentElement.classList.add('locked');
}
function unlockScroll() {
  locked = Math.max(0, locked - 1);
  if (locked === 0) {
    lenis.start();
    document.documentElement.classList.remove('locked');
  }
}

/* =========================================================
   4. REVEAL PRIMITIVES (GSAP)
   ========================================================= */
function splitWords(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const words = text.split(/\s+/);
  const inners = [];
  words.forEach((w, i) => {
    const box = document.createElement('span');
    box.className = 'clip-box';
    const inner = document.createElement('span');
    inner.className = 'clip-inner';
    inner.textContent = w;
    box.appendChild(inner);
    el.appendChild(box);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    inners.push(inner);
  });
  return inners;
}

function revealWords(inners, opts = {}) {
  const stagger = (opts.stagger ?? 140) / 1000;
  const duration = (opts.duration ?? 1100) / 1000;
  const delay = (opts.delay ?? 0) / 1000;

  if (reduced || !hasGSAP) {
    inners.forEach(el => { el.style.transform = 'translateY(0)'; el.style.opacity = '1'; });
    return;
  }
  gsap.set(inners, { yPercent: 115, opacity: 0 });
  gsap.to(inners, {
    yPercent: 0, opacity: 1, duration, delay, stagger,
    ease: 'power4.out'
  });
}

function revealLines(lines, opts = {}) {
  const arr = Array.isArray(lines) ? lines : [...lines];
  const baseDelay = (opts.baseDelay ?? 0) / 1000;
  const stagger = (opts.stagger ?? 120) / 1000;
  const duration = (opts.duration ?? 950) / 1000;

  if (reduced || !hasGSAP) {
    arr.forEach(el => { el.style.transform = 'translateY(0)'; el.style.opacity = '1'; });
    return;
  }
  gsap.set(arr, { yPercent: 115, opacity: 0 });
  gsap.to(arr, {
    yPercent: 0, opacity: 1, duration, delay: baseDelay, stagger,
    ease: 'power4.out'
  });
}

function inview(el, opts = {}) {
  if (!hasGSAP) return;
  if (reduced) {
    gsap.set(el, Object.assign({}, opts.to || {}, { clearProps: 'transform' }));
    return;
  }
  gsap.from(el, Object.assign({}, opts.from || {}, {
    duration: opts.duration ?? 0.95,
    ease: opts.ease || 'power3.out',
    delay: (opts.delayIn ?? 0) / 1000,
    scrollTrigger: {
      trigger: el,
      start: 'top 88%',
      toggleActions: 'play none none none'
    }
  }));
}

/* =========================================================
   5. LOADER — GSAP timeline
   ========================================================= */
const MIN_VISIBLE_MS = 1400, MAX_VISIBLE_MS = 2600, EXIT_MS = 850;
const minVisible = reduced ? 200 : MIN_VISIBLE_MS;
const exitMs = reduced ? 0 : EXIT_MS;

const loaderEl = document.getElementById('loader');
const loaderMark = document.getElementById('loaderMark');
const loaderFill = document.getElementById('loaderFill');

lockScroll();

if (hasGSAP && !reduced) {
  gsap.fromTo(loaderMark, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
  gsap.to(loaderFill, { scaleX: 1, duration: (minVisible - 120) / 1000, delay: 0.12, ease: 'power2.inOut' });
} else {
  loaderMark.style.opacity = '1';
  loaderFill.style.transform = 'scaleX(1)';
}

let ready = false;
let countdownStarted = false;
function startCountdown() {
  if (countdownStarted) return;
  countdownStarted = true;
  setTimeout(finishLoader, minVisible);
}
if (document.readyState === 'complete') startCountdown();
else window.addEventListener('load', startCountdown);
setTimeout(startCountdown, MAX_VISIBLE_MS);

function finishLoader() {
  if (ready) return;
  ready = true;
  loaderFill.style.transform = 'scaleX(1)';
  unlockScroll();
  revealHero();

  if (exitMs <= 0 || !hasGSAP) {
    loaderEl.remove();
    return;
  }
  gsap.to(loaderEl, {
    yPercent: -105,
    duration: exitMs / 1000,
    ease: 'power4.inOut',
    onComplete: () => loaderEl.remove()
  });
}

/* =========================================================
   6. HERO
   ========================================================= */
const heroTitleEl = document.getElementById('hero-title');
const heroTitleWords = splitWords(heroTitleEl);

if (hasGSAP && hasST && !reduced) {
  // Parallax on hero plate
  gsap.to('#heroPlate', {
    yPercent: 12,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8
    }
  });
}

const collectionData = [
  { img: '2.webp', brand: 'Baseline Pro', title: 'Featured Gear', cta: 'Shop the kit', alt: 'Player driving a backhand on a hard court' },
  { img: '3.webp', brand: 'Court Series', title: 'Summer Drop', cta: 'View the line', alt: 'Player stretching for a forehand on clay' },
  { img: '5.webp', brand: 'Academy Kit', title: 'Junior Range', cta: 'Browse juniors', alt: 'Player set in a ready stance on clay' }
];
const ASSET = 'https://api.getlayers.ai/storage/v1/object/public/public/assets/baseline-88535e4000/';

const collectionStage = document.getElementById('collectionStage');
const collectionDotsEl = document.getElementById('collectionDots');
let collectionIndex = 0;
let collectionTimer = null;

function buildCollectionCard(d, absolute) {
  const card = document.createElement('div');
  card.className = 'collection-card';
  if (absolute) { card.style.position = 'absolute'; card.style.inset = '0'; }
  card.innerHTML = `
    <img src="${ASSET}${d.img}" alt="${d.alt}" loading="lazy">
    <div class="collection-meta">
      <span class="collection-brand">${d.brand}</span>
      <span class="collection-title">${d.title}</span>
      <span class="collection-cta">${d.cta} →</span>
    </div>`;
  return card;
}

function makeDots(container, count, tone, onSelect) {
  container.innerHTML = '';
  container.dataset.tone = tone;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.setAttribute('aria-label', `Go to slide ${i + 1}`);
    b.addEventListener('click', () => onSelect(i));
    container.appendChild(b);
  }
  return {
    set(active) {
      [...container.children].forEach((c, i) => c.setAttribute('aria-current', i === active ? 'true' : 'false'));
    }
  };
}

const collectionDots = makeDots(collectionDotsEl, collectionData.length, 'light', i => {
  if (i === collectionIndex) return;
  setCollection(i);
  restartCollectionTimer();
});

function setCollection(i, initial) {
  collectionIndex = i;
  collectionDots.set(i);
  const old = collectionStage.querySelector('.collection-card');
  const next = buildCollectionCard(collectionData[i], !initial);

  if (initial) {
    collectionStage.appendChild(next);
    if (reduced || !hasGSAP) { next.style.opacity = '1'; return; }
    gsap.fromTo(next,
      { opacity: 0, y: 16, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' });
    return;
  }

  if (!old) { setCollection(i, true); return; }

  if (reduced || !hasGSAP) {
    old.remove();
    next.style.opacity = '1';
    next.style.transform = 'none';
    return;
  }

  next.style.opacity = '0';
  next.style.transform = 'translateY(16px) scale(0.96)';
  collectionStage.appendChild(next);

  gsap.to(old, { opacity: 0, y: 16, scale: 0.96, duration: 0.4, ease: 'power2.in', onComplete: () => old.remove() });
  gsap.to(next, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out' });
}

function restartCollectionTimer() {
  clearInterval(collectionTimer);
  collectionTimer = setInterval(() => {
    if (!ready) return;
    setCollection((collectionIndex + 1) % collectionData.length);
  }, 3800);
}

function revealHero() {
  revealWords(heroTitleWords, { stagger: 140, duration: 1100 });
  revealLines(document.querySelectorAll('.hero-tagline .line-inner'), {
    baseDelay: 350, stagger: 110, duration: 900
  });

  setCollection(0, true);
  restartCollectionTimer();

  inview(document.getElementById('collectionSlider'), {
    from: { opacity: 0, y: 28 }, to: { opacity: 1, y: 0 }, delayIn: 650
  });
  inview(document.getElementById('membershipCard'), {
    from: { opacity: 0, y: 28 }, to: { opacity: 1, y: 0 }, delayIn: 780
  });
}

/* =========================================================
   7. MARQUEE — infinite scroll with GSAP
   ========================================================= */
(function initMarquee() {
  if (!hasGSAP || reduced) return;
  const track = document.getElementById('marqueeTrack');
  if (!track) return;

  // Duplicate 3x so the loop is seamless
  const original = track.innerHTML;
  track.innerHTML = original + original + original;

  requestAnimationFrame(() => {
    const oneThird = track.scrollWidth / 3;
    gsap.set(track, { x: 0 });
    gsap.to(track, {
      x: -oneThird,
      duration: oneThird / 80,   // ~80px per second
      ease: 'none',
      repeat: -1
    });
  });
})();

/* =========================================================
   8. TRUST SECTION
   ========================================================= */
const trustSlides = [
  { img: '5.webp', name: 'Marco Vidal', role: 'Head Coach', alt: 'Head coach set in a ready stance on clay', headline: ['Expert', 'Result-', 'Driven', 'Coaching'] },
  { img: '4.webp', name: 'Elena Sokolova', role: 'Performance Coach', alt: 'Performance coach following through on a serve', headline: ['Sharper', 'Faster', 'Stronger', 'Player'] },
  { img: '1.webp', name: 'James Okoro', role: 'Juniors Lead', alt: 'Juniors lead waiting to return on clay', headline: ['Future', 'Champions', 'Start', 'Here'] }
];

const ghostInnerEls = [...document.querySelectorAll('#trustTitle .gw-inner')];
const coachImgA = document.getElementById('coachImgA');
const coachImgB = document.getElementById('coachImgB');
const coachNameEl = document.getElementById('coachName');
const coachRoleEl = document.getElementById('coachRole');
let coachFront = coachImgA, coachBack = coachImgB;
let trustIndex = 0;

trustSlides.forEach(s => { const im = new Image(); im.src = ASSET + s.img; });

function setGhostWords(words) {
  ghostInnerEls.forEach((el, i) => { el.textContent = words[i]; });

  if (hasGSAP) gsap.killTweensOf(ghostInnerEls);

  if (reduced || !hasGSAP) {
    ghostInnerEls.forEach(el => { el.style.transform = 'none'; el.style.opacity = '1'; });
    return;
  }

  gsap.set(ghostInnerEls, { yPercent: 115, opacity: 0 });
  gsap.to(ghostInnerEls, {
    yPercent: 0,
    opacity: 1,
    duration: 0.85,
    stagger: 0.08,
    ease: 'power3.out',
    overwrite: true,
    clearProps: 'transform'
  });
}

function crossFadeCoach(src, alt) {
  const incoming = coachBack, outgoing = coachFront;
  incoming.src = src;
  incoming.alt = alt;
  outgoing.alt = '';

  if (reduced || !hasGSAP) {
    incoming.style.opacity = '1';
    outgoing.style.opacity = '0';
    coachFront = incoming; coachBack = outgoing;
    return;
  }
  gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' });
  gsap.to(outgoing, { opacity: 0, duration: 0.45, ease: 'power2.in' });
  coachFront = incoming;
  coachBack = outgoing;
}

const trustDots = makeDots(document.getElementById('trustDots'), trustSlides.length, 'dark', i => setTrust(i));

function setTrust(i) {
  trustIndex = ((i % trustSlides.length) + trustSlides.length) % trustSlides.length;
  const s = trustSlides[trustIndex];
  trustDots.set(trustIndex);
  setGhostWords(s.headline);
  crossFadeCoach(ASSET + s.img, s.alt);
  coachNameEl.textContent = s.name;
  coachRoleEl.textContent = s.role;
}

document.getElementById('trustPrev').addEventListener('click', () => setTrust(trustIndex - 1));
document.getElementById('trustNext').addEventListener('click', () => setTrust(trustIndex + 1));

/* Ghost word parallax + subtle rotation */
if (hasGSAP && hasST && !reduced) {
  const ghostWordEls = [...document.querySelectorAll('#trustTitle .ghost-word')];
  const ghostRanges = [[-3, 3], [3, -3], [-2, 4], [4, -3]];

  ghostWordEls.forEach((el, i) => {
    const [a, b] = ghostRanges[i];
    gsap.fromTo(el,
      { xPercent: a },
      {
        xPercent: b,
        ease: 'none',
        scrollTrigger: {
          trigger: '#trust',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8
        }
      });
  });

  // Subtle rotation — kept small to avoid edge clipping
  gsap.fromTo('#trustTitle',
    { rotation: 0.35 },
    {
      rotation: -0.35,
      ease: 'none',
      scrollTrigger: {
        trigger: '#trust',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2
      }
    });
}

inview(document.getElementById('percentBadge'), {
  from: { opacity: 0, scale: 0.9 }, to: { opacity: 1, scale: 1 }
});
inview(document.getElementById('badgeCard'), {
  from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, delayIn: 120
});
inview(document.getElementById('coachCard'), {
  from: { opacity: 0, y: 60, scale: 0.92 }, to: { opacity: 1, y: 0, scale: 1 },
  duration: 1.15, ease: 'power3.out'
});

setGhostWords(trustSlides[0].headline);
trustDots.set(0);

/* =========================================================
   9. PROGRAMS
   ========================================================= */
if (hasGSAP && hasST) {
  ScrollTrigger.create({
    trigger: '#programsTitle',
    start: 'top 88%',
    once: true,
    onEnter: () => revealLines(document.querySelectorAll('#programsTitle .line-inner'), { stagger: 120, duration: 950 })
  });
}

if (hasGSAP && hasST && !reduced) {
  const rows = [...document.querySelectorAll('#programList .program-row')];
  rows.forEach((row, i) => {
    const fromX = i % 2 === 0 ? -60 : 60;
    gsap.from(row, {
      x: fromX,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: row,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });

    const arrow = row.querySelector('.program-arrow');
    if (hasGSAP) {
      const setX = gsap.quickTo(arrow, 'x', { duration: 0.4, ease: 'power3' });
      const setO = gsap.quickTo(arrow, 'opacity', { duration: 0.35, ease: 'power3' });
      if (hoverable()) {
        row.addEventListener('pointerenter', () => { setX(8); setO(1); });
        row.addEventListener('pointerleave', () => { setX(0); setO(0.55); });
      }
    }
  });
} else {
  [...document.querySelectorAll('#programList .program-row')].forEach((row, i) => {
    inview(row, { from: { opacity: 0, y: 26 }, to: { opacity: 1, y: 0 }, delayIn: i * 90 });
  });
}

/* =========================================================
   10. FACILITIES
   ========================================================= */
inview(document.getElementById('facIcon'), {
  from: { opacity: 0, scale: 0.85 }, to: { opacity: 1, scale: 1 }
});

if (hasGSAP && hasST) {
  ScrollTrigger.create({
    trigger: '#facilitiesTitle',
    start: 'top 88%',
    once: true,
    onEnter: () => revealLines(document.querySelectorAll('#facilitiesTitle .line-inner'), { stagger: 120, duration: 950 })
  });
}

(function () {
  const p = document.getElementById('facBody');
  const text = p.textContent.trim();
  p.textContent = '';
  const words = text.split(/\s+/);
  const els = words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    p.appendChild(s);
    if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
    return s;
  });

  if (hasGSAP && hasST && !reduced) {
    gsap.set(els, { opacity: 0, y: 18 });
    gsap.to(els, {
      opacity: 1, y: 0,
      duration: 0.7,
      stagger: 0.028,
      delay: 0.25,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: p,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });
  } else {
    els.forEach(el => { el.style.opacity = '1'; });
  }
})();

[...document.querySelectorAll('.court-card')].forEach((card, i) => {
  inview(card, { from: { opacity: 0, y: 48 }, to: { opacity: 1, y: 0 }, delayIn: i * 140 });

  const img = card.querySelector('img');
  if (hasGSAP && hasST && !reduced) {
    gsap.fromTo(img,
      { scale: 1.15 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: card,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }
      });
    const setS = gsap.quickTo(img, 'scale', { duration: 0.5, ease: 'power3' });
    if (hoverable()) {
      card.addEventListener('pointerenter', () => setS(1.06));
      card.addEventListener('pointerleave', () => setS(1));
    }
  }
});

/* =========================================================
   11. STATS — animated counters
   ========================================================= */
if (hasGSAP && hasST) {
  ScrollTrigger.create({
    trigger: '#statsTitle',
    start: 'top 88%',
    once: true,
    onEnter: () => revealLines(document.querySelectorAll('#statsTitle .line-inner'), { stagger: 120, duration: 950 })
  });

  [...document.querySelectorAll('#statsGrid .stat-cell')].forEach((cell, i) => {
    inview(cell, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 }, delayIn: i * 110 });

    const valueEl = cell.querySelector('.stat-value');
    if (!valueEl) return;
    const target = parseInt(valueEl.dataset.count || '0', 10);
    const suffix = valueEl.dataset.suffix || '';
    const isK = suffix.includes('K');

    if (reduced) {
      valueEl.textContent = (isK ? Math.round(target / 1000) : target) + suffix;
      return;
    }

    const counter = { val: 0 };
    ScrollTrigger.create({
      trigger: cell,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(counter, {
          val: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: () => {
            const v = Math.round(counter.val);
            valueEl.textContent = (isK ? Math.round(v / 1000) : v) + suffix;
          }
        });
      }
    });
  });
}

/* =========================================================
   12. TESTIMONIALS — 3D flip entrance
   ========================================================= */
if (hasGSAP && hasST) {
  ScrollTrigger.create({
    trigger: '#testimonialsTitle',
    start: 'top 88%',
    once: true,
    onEnter: () => revealLines(document.querySelectorAll('#testimonialsTitle .line-inner'), { stagger: 120, duration: 950 })
  });
}

[...document.querySelectorAll('#testimonialList .testimonial-card')].forEach((card, i) => {
  if (hasGSAP && hasST && !reduced) {
    gsap.from(card, {
      opacity: 0,
      y: 60,
      rotateX: -25,
      transformPerspective: 1000,
      duration: 1.1,
      delay: i * 0.12,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });

    const setY = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power3' });
    if (hoverable()) {
      card.addEventListener('pointerenter', () => setY(-8));
      card.addEventListener('pointerleave', () => setY(0));
    }
  } else {
    inview(card, { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 }, delayIn: i * 120 });
  }
});

/* =========================================================
   13. FOOTER
   ========================================================= */
if (hasGSAP && hasST) {
  ScrollTrigger.create({
    trigger: '#footerCta',
    start: 'top 88%',
    once: true,
    onEnter: () => revealLines(document.querySelectorAll('#footerCta .line-inner'), { stagger: 120, duration: 950 })
  });
}
inview(document.getElementById('footerCtaBtn'), {
  from: { opacity: 0, y: 20 }, to: { opacity: 1, y: 0 }, delayIn: 150
});

/* =========================================================
   14. HOVER MICRO-INTERACTIONS
   ========================================================= */
document.querySelectorAll('.pill-btn').forEach(btn => {
  if (!hasGSAP) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;
  const setX = gsap.quickTo(svg, 'x', { duration: 0.4, ease: 'power3' });
  btn.addEventListener('pointerenter', () => setX(5));
  btn.addEventListener('pointerleave', () => setX(0));
});

document.querySelectorAll('.arrow-btn').forEach(btn => {
  if (!hasGSAP) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;
  const setS = gsap.quickTo(svg, 'scale', { duration: 0.4, ease: 'power3' });
  btn.addEventListener('pointerenter', () => setS(1.15));
  btn.addEventListener('pointerleave', () => setS(1));
});

document.querySelectorAll('[data-xrotate]').forEach(btn => {
  if (!hasGSAP) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;
  const setR = gsap.quickTo(svg, 'rotation', { duration: 0.5, ease: 'power3' });
  btn.addEventListener('pointerenter', () => setR(90));
  btn.addEventListener('pointerleave', () => setR(0));
});

/* Magnetic buttons */
if (hasGSAP) {
  const magnetics = document.querySelectorAll('.pill-btn, .header-cta, #footerCtaBtn');
  magnetics.forEach(el => {
    if (window.innerWidth < 1024) return;
    const setX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const setY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left - rect.width / 2;
      const relY = e.clientY - rect.top - rect.height / 2;
      setX(relX * 0.25);
      setY(relY * 0.35);
    });
    el.addEventListener('mouseleave', () => { setX(0); setY(0); });
  });
}

/* =========================================================
   15. CONTACT MODAL — GSAP timeline
   ========================================================= */
const modalEl = document.getElementById('modal');
const modalPanel = modalEl.querySelector('.modal-panel');
const modalBackdrop = modalEl.querySelector('.modal-backdrop');
const modalForm = document.getElementById('modalForm');
const modalSuccess = document.getElementById('modalSuccess');
const successText = document.getElementById('successText');
const submitBtn = document.getElementById('submitBtn');
const fieldName = document.getElementById('fieldName');
const modalTitleLines = modalEl.querySelectorAll('.modal-title .line-inner');

let modalIsOpen = false;

function openModal() {
  if (modalIsOpen) return;
  modalIsOpen = true;
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  lockScroll();

  modalForm.hidden = false;
  modalSuccess.hidden = true;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Request a visit';

  if (hasGSAP && !reduced) {
    gsap.set(modalTitleLines, { yPercent: 115, opacity: 0 });
    const tl = gsap.timeline();
    tl.fromTo(modalBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })
      .fromTo(modalPanel,
        { opacity: 0, y: 28, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power3.out' },
        '-=0.3')
      .to(modalTitleLines,
        { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.09, ease: 'power3.out' },
        '-=0.4');
  } else {
    modalBackdrop.style.opacity = '1';
    modalPanel.style.opacity = '1';
    modalPanel.style.transform = 'none';
    modalTitleLines.forEach(el => { el.style.opacity = '1'; });
  }

  setTimeout(() => { if (fieldName) fieldName.focus(); }, 260);
}

function closeModal() {
  if (!modalIsOpen) return;
  modalIsOpen = false;
  modalEl.setAttribute('aria-hidden', 'true');

  if (hasGSAP && !reduced) {
    const tl = gsap.timeline({
      onComplete: () => {
        modalEl.classList.remove('open');
        modalForm.reset();
        modalForm.hidden = false;
        modalSuccess.hidden = true;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request a visit';
      }
    });
    tl.to(modalPanel, { opacity: 0, y: 28, scale: 0.96, duration: 0.4, ease: 'power2.in' })
      .to(modalBackdrop, { opacity: 0, duration: 0.3 }, '-=0.2');
  } else {
    modalEl.classList.remove('open');
    modalForm.reset();
  }
  unlockScroll();
}

document.querySelectorAll('[data-open-modal]').forEach(b => b.addEventListener('click', openModal));
document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));

modalForm.addEventListener('submit', e => {
  e.preventDefault();
  const first = (fieldName.value || '').trim().split(/\s+/)[0] || 'there';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  setTimeout(() => {
    modalForm.hidden = true;
    modalSuccess.hidden = false;
    successText.textContent = `Thanks, ${first} — our team will be in touch to lock in your visit.`;
    if (hasGSAP && !reduced) {
      gsap.fromTo(modalSuccess, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    }
  }, 700);
});

/* =========================================================
   16. FULLSCREEN MENU — GSAP timeline
   ========================================================= */
const menuEl = document.getElementById('menu');
const menuPanel = document.getElementById('menuPanel');
const menuBackdrop = menuEl.querySelector('.menu-backdrop');
const menuLinks = [...document.querySelectorAll('.menu-link')];
let menuIsOpen = false;
let menuTl = null;

if (hasGSAP) {
  menuTl = gsap.timeline({ paused: true });
  menuTl.fromTo(menuBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  menuTl.fromTo(menuPanel,
    { opacity: 0, y: -30 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
    '-=0.2');
  menuTl.fromTo(menuLinks,
    { opacity: 0, y: 28 },
    { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power3.out' },
    '-=0.35');
}

function openMenu() {
  if (menuIsOpen) return;
  menuIsOpen = true;
  menuEl.classList.add('open');
  menuEl.setAttribute('aria-hidden', 'false');
  lockScroll();
  if (menuTl) menuTl.play();
  else {
    menuBackdrop.style.opacity = '1';
    menuPanel.style.opacity = '1';
    menuLinks.forEach(l => l.style.opacity = '1');
  }
}

function closeMenu() {
  if (!menuIsOpen) return;
  menuIsOpen = false;
  menuEl.setAttribute('aria-hidden', 'true');
  if (menuTl) {
    menuTl.reverse();
    setTimeout(() => menuEl.classList.remove('open'), 800);
  } else {
    menuEl.classList.remove('open');
  }
  unlockScroll();
}

document.querySelectorAll('[data-open-menu]').forEach(b => b.addEventListener('click', openMenu));
document.querySelectorAll('[data-close-menu]').forEach(b => b.addEventListener('click', closeMenu));
document.getElementById('menuCta').addEventListener('click', () => { closeMenu(); setTimeout(openModal, 300); });

/* =========================================================
   17. SMOOTH ANCHOR SCROLLING via Lenis
   ========================================================= */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    if (menuIsOpen) closeMenu();
    lenis.scrollTo(target, { offset: 0, duration: 1.2 });
  });
});

/* =========================================================
   18. ESC KEY
   ========================================================= */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (modalIsOpen) closeModal();
  else if (menuIsOpen) closeMenu();
});

/* =========================================================
   19. REFRESH ON LOAD + FONTS
   ========================================================= */
window.addEventListener('load', () => {
  if (hasST) ScrollTrigger.refresh();
});
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (hasST) ScrollTrigger.refresh(); });
}