// ZeroU · landing — interaction
// On-theme motion: scroll progress, reveal stagger, verdict stamp,
// pipeline live readout, thinking counters, copy CLI.
// Respects prefers-reduced-motion and avoids layout thrash.

(function () {
  'use strict';

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Mark reveal targets + per-child stagger ─────────────────
  function tagReveal(selector, baseDelayMs, stepMs) {
    var nodes = document.querySelectorAll(selector);
    nodes.forEach(function (n, i) {
      n.setAttribute('data-reveal', '');
      n.style.setProperty('--reveal-d', (baseDelayMs + i * stepMs) / 1000 + 's');
    });
  }

  // Hero is animated via CSS keyframes; don't re-reveal it.
  tagReveal('.case-head', 0, 0);
  tagReveal('.case .exhibits .exhibit', 80, 90);
  tagReveal('.rehearsal-subject', 0, 0);
  tagReveal('.rehearsal-voices .voice', 80, 90);
  tagReveal('.comparison .compare', 0, 100);
  tagReveal('.receipt', 200, 0);
  tagReveal('.verdict', 220, 0);
  tagReveal('.theatre-frame', 100, 0);
  tagReveal('.theatre-strip .strip-cell', 220, 80);
  tagReveal('.gate', 0, 70);
  tagReveal('.promise', 0, 60);
  tagReveal('.affirmation-body', 0, 0);
  tagReveal('.download-text', 0, 0);
  tagReveal('.download-actions', 100, 0);

  // ─── IntersectionObserver-driven reveal + side effects ───────
  if (!prefersReduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('is-in');

          // Trigger counter when verdict enters viewport
          if (el.classList.contains('verdict')) {
            el.querySelectorAll('[data-count-to]').forEach(function (counter) {
              animateCounter(
                counter,
                parseInt(counter.getAttribute('data-count-to'), 10) || 0,
                1400,
              );
            });
          }
          io.unobserve(el);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );

    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      io.observe(el);
    });
  } else {
    // Reduced motion: flip everything on immediately.
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('is-in');
    });
    document.querySelectorAll('[data-count-to]').forEach(function (el) {
      el.textContent = el.getAttribute('data-count-to');
    });
  }

  // ─── Counter (number ticker) ────────────────────────────────
  function animateCounter(el, to, durMs) {
    if (prefersReduced) {
      el.textContent = String(to);
      return;
    }
    var from = parseInt(el.textContent, 10) || 0;
    var start = performance.now();
    function tick(t) {
      var p = Math.min(1, (t - start) / durMs);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── Docket scroll progress + shadow state ──────────────────
  var docket = document.querySelector('.docket');
  var docketProg = document.querySelector('.docket-progress');
  var lastScrollUpdate = 0;
  function onScroll() {
    var now = performance.now();
    if (now - lastScrollUpdate < 14) return;
    lastScrollUpdate = now;

    var sy = window.scrollY || window.pageYOffset || 0;
    if (docket) {
      if (sy > 8) docket.classList.add('is-scrolled');
      else docket.classList.remove('is-scrolled');
    }
    if (docketProg) {
      var max =
        document.documentElement.scrollHeight - window.innerHeight || 1;
      var pct = Math.max(0, Math.min(1, sy / max));
      docketProg.style.transform = 'scaleX(' + pct.toFixed(4) + ')';
    }
  }
  if (docket || docketProg) {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  // ─── Case watermark slide-in ────────────────────────────────
  document.querySelectorAll('.case[data-case-num]').forEach(function (c) {
    if (c.querySelector('.case-watermark')) return;
    var w = document.createElement('span');
    w.className = 'case-watermark';
    w.setAttribute('aria-hidden', 'true');
    w.textContent = 'shift ' + c.getAttribute('data-case-num');
    c.insertBefore(w, c.firstChild);
  });

  if (!prefersReduced && 'IntersectionObserver' in window) {
    var caseIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('case-in');
            caseIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -4% 0px' },
    );
    document.querySelectorAll('.case[data-case-num]').forEach(function (el) {
      caseIO.observe(el);
    });
  } else {
    document.querySelectorAll('.case[data-case-num]').forEach(function (el) {
      el.classList.add('case-in');
    });
  }

  // ─── Pipeline live readout · 4-stage cycle ──────────────────
  // Cycles through scenarios:
  //   1) all pass (the docs-changelog happy path)
  //   2) alignment low → fail at G2
  //   3) adversarial break → fail at G4
  //   4) reset to idle
  var pipeline = document.querySelector('[data-pipeline]');
  if (pipeline && !prefersReduced) {
    var stages = pipeline.querySelectorAll('.pstage');
    var scenarios = [
      // Each scenario is an array of stage outcomes:
      // 'pass' | 'fail' | 'skip'
      ['pass', 'pass', 'pass', 'skip'], // happy path (docs)
      ['pass', 'fail', null, null],     // alignment low
      ['pass', 'pass', 'pass', 'fail'], // adversarial break (auth)
    ];
    var scenarioVerdicts = [
      ['0 ERR', '0.98 / 0.7', 'APPROVE', 'SKIPPED'],
      ['0 ERR', '0.55 / 0.7', '—', '—'],
      ['0 ERR', '0.92 / 0.7', 'APPROVE', 'BREAK · session-fixation'],
    ];

    var scenarioIdx = 0;

    function resetStages() {
      stages.forEach(function (s) {
        s.classList.remove('is-active', 'is-pass', 'is-fail');
        var v = s.querySelector('[data-verdict]');
        if (v) v.textContent = '—';
      });
    }

    function runScenario(idx) {
      resetStages();
      var pattern = scenarios[idx];
      var verdicts = scenarioVerdicts[idx];
      var i = 0;
      function step() {
        if (i >= stages.length) {
          // Hold the final state for a beat, then advance
          setTimeout(function () {
            scenarioIdx = (scenarioIdx + 1) % scenarios.length;
            runScenario(scenarioIdx);
          }, 2400);
          return;
        }
        var stage = stages[i];
        var outcome = pattern[i];
        var verdict = verdicts[i];

        // Light up
        stages.forEach(function (s) {
          s.classList.remove('is-active');
        });
        stage.classList.add('is-active');

        setTimeout(function () {
          stage.classList.remove('is-active');
          if (outcome === 'pass') stage.classList.add('is-pass');
          else if (outcome === 'fail') stage.classList.add('is-fail');
          else if (outcome === 'skip') stage.classList.add('is-pass');

          var v = stage.querySelector('[data-verdict]');
          if (v) v.textContent = verdict || '—';

          i++;
          // If this stage failed, halt the rest (verdicts already null)
          if (outcome === 'fail') {
            setTimeout(function () {
              scenarioIdx = (scenarioIdx + 1) % scenarios.length;
              runScenario(scenarioIdx);
            }, 2400);
            return;
          }
          if (outcome === null) {
            setTimeout(function () {
              scenarioIdx = (scenarioIdx + 1) % scenarios.length;
              runScenario(scenarioIdx);
            }, 2400);
            return;
          }
          setTimeout(step, 600);
        }, 700);
      }
      step();
    }

    // Kick off after hero entry settles
    setTimeout(function () {
      runScenario(scenarioIdx);
    }, 2600);
  } else if (pipeline) {
    // Reduced motion: show a single static "all pass" state
    var stages2 = pipeline.querySelectorAll('.pstage');
    var staticVerdicts = ['0 ERR', '0.98 / 0.7', 'APPROVE', 'SKIPPED'];
    stages2.forEach(function (s, i) {
      s.classList.add('is-pass');
      var v = s.querySelector('[data-verdict]');
      if (v) v.textContent = staticVerdicts[i];
    });
  }

  // ─── Copy CLI command ───────────────────────────────────────
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var label = btn.textContent;
      var done = function () {
        btn.setAttribute('data-copied', 'true');
        btn.textContent = '已复制';
        setTimeout(function () {
          btn.removeAttribute('data-copied');
          btn.textContent = label;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch (e) {
          /* noop */
        }
        document.body.removeChild(ta);
      }
    });
  });

  // ─── Footer year (if any data-year attr) ────────────────────
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ─── Exhibit + voice 3D mouse-tracked tilt ────────────────
  // Subtle parallax, max 6deg, eases back when mouse leaves
  if (!prefersReduced) {
    var tiltTargets = document.querySelectorAll(
      '.exhibit, .voice, .compare, .strip-cell',
    );
    tiltTargets.forEach(function (card) {
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';

      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;  // 0..1
        var y = (e.clientY - rect.top) / rect.height;  // 0..1
        var tiltX = (0.5 - y) * 5;   // up-down rotation
        var tiltY = (x - 0.5) * 5;   // left-right rotation
        card.style.transform =
          'perspective(900px) rotateX(' +
          tiltX.toFixed(2) +
          'deg) rotateY(' +
          tiltY.toFixed(2) +
          'deg) translateY(-3px)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  // ─── Floating ambient orbs (canvas, very low-density) ─────
  // 8 mint dots drifting slowly. Pure visual flair, no interaction.
  if (!prefersReduced && document.querySelector('.hero')) {
    var orbCanvas = document.createElement('canvas');
    orbCanvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0.55;';
    document.body.appendChild(orbCanvas);
    var ctx2 = orbCanvas.getContext('2d');

    function resizeOrb() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      orbCanvas.width = window.innerWidth * dpr;
      orbCanvas.height = window.innerHeight * dpr;
      orbCanvas.style.width = window.innerWidth + 'px';
      orbCanvas.style.height = window.innerHeight + 'px';
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeOrb();
    window.addEventListener('resize', resizeOrb, { passive: true });

    var ORBS = 7;
    var orbs = [];
    for (var k = 0; k < ORBS; k++) {
      orbs.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.08 - Math.random() * 0.12,
        hue: Math.random() > 0.7 ? 'gold' : 'mint',
        a: 0.3 + Math.random() * 0.4,
      });
    }

    function drawOrbs() {
      ctx2.clearRect(0, 0, orbCanvas.width, orbCanvas.height);
      orbs.forEach(function (o) {
        o.x += o.vx;
        o.y += o.vy;
        // wrap
        if (o.x < -10) o.x = window.innerWidth + 10;
        if (o.x > window.innerWidth + 10) o.x = -10;
        if (o.y < -10) o.y = window.innerHeight + 10;

        var col =
          o.hue === 'gold'
            ? 'rgba(255, 214, 107,'
            : 'rgba(124, 255, 178,';

        // glow
        var grad = ctx2.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 8);
        grad.addColorStop(0, col + (o.a * 0.8) + ')');
        grad.addColorStop(0.4, col + (o.a * 0.25) + ')');
        grad.addColorStop(1, col + '0)');
        ctx2.fillStyle = grad;
        ctx2.beginPath();
        ctx2.arc(o.x, o.y, o.r * 8, 0, Math.PI * 2);
        ctx2.fill();

        // core
        ctx2.fillStyle = col + o.a + ')';
        ctx2.beginPath();
        ctx2.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx2.fill();
      });
      requestAnimationFrame(drawOrbs);
    }
    requestAnimationFrame(drawOrbs);
  }

  // ─── Counter blur during ticker (extends animateCounter feel) ──
  // wraps existing counter logic: add a `.is-ticking` class while running
  // already happens via animateCounter — we just style it. CSS hook below.
})();
