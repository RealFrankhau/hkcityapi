/* ============================================================
   qnav.js — Quick Nav: floating button + slide-in sidebar
   每頁快速跳到指定卡片 Quick-jump navigation for cards within a page
   ============================================================ */

'use strict';

(function() {
  const PAGE_NAME_MAP = {
    home:     '總覽',
    weather:  '天氣',
    transport:'鐵路',
    bus:      '巴士',
    cruise:   '渡輪',
    health:   '醫療',
    holidays: '假期',
    airport:  '航班'
  };

  let fab        = null;
  let panel      = null;
  let backdrop   = null;
  let closeBtn   = null;
  let listEl     = null;
  let pageNameEl = null;
  let currentPage = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    fab      = document.getElementById('qnav-fab');
    panel    = document.getElementById('qnav-panel');
    backdrop = document.getElementById('qnav-backdrop');
    closeBtn = document.getElementById('qnav-close');
    listEl   = document.getElementById('qnav-list');
    pageNameEl = document.getElementById('qnav-page-name');

    if (!fab || !panel || !backdrop || !closeBtn || !listEl) return;

    fab.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);

    // Esc to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    // Build list for the initial (home) page
    rebuild();
  }

  function toggle() {
    if (panel.classList.contains('is-open')) close();
    else open();
  }

  function open() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    fab.classList.add('is-open');
    fab.setAttribute('aria-label', '關閉快速導覽');
  }

  function close() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    fab.classList.remove('is-open');
    fab.setAttribute('aria-label', '開啟快速導覽');
  }

  /* Public: rebuild the nav list for the current page. Safe to call
     repeatedly; observers will re-collect cards as data loads.       */
  function rebuild() {
    const page = getActivePage();
    currentPage = page;
    if (!page) {
      renderEmpty();
      return;
    }

    if (pageNameEl) {
      pageNameEl.textContent = (PAGE_NAME_MAP[page] || page) + ' · 本頁資訊';
    }

    collectCards(page).then(function(cards) {
      // Skip if the user has switched to a different page while we waited
      if (currentPage !== page) return;
      if (!cards.length) {
        renderEmpty();
        return;
      }
      renderList(cards, page);
    });
  }

  function getActivePage() {
    const active = document.querySelector('.page.active');
    if (!active) return null;
    const id = active.id || '';
    return id.startsWith('page-') ? id.slice(5) : null;
  }

  /* Collect every card-like container in the active page that has
     a usable title. Wait one frame so freshly-rendered cards
     (e.g. async API responses) are picked up.                        */
  function collectCards(page) {
    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        const pageEl = document.getElementById('page-' + page);
        if (!pageEl) return resolve([]);

        const nodes = pageEl.querySelectorAll('.card');
        const seen = new Set();
        const out  = [];

        nodes.forEach(function(card) {
          // Skip warning strips and other non-card .warn-strip elements
          // (the page does not contain them inside .card, so no extra filter needed)
          if (!card.isConnected) return;

          // Require a usable title or sub-title to navigate to
          const title = extractTitle(card);
          if (!title) return;

          // Avoid duplicates (e.g. the same card nested twice)
          if (seen.has(card)) return;
          seen.add(card);

          // Ensure the card has a stable id we can scroll to
          if (!card.id) card.id = 'qnav-card-' + page + '-' + out.length;
          out.push({ id: card.id, title: title });
        });

        resolve(out);
      });
    });
  }

  function extractTitle(card) {
    // Prefer the most prominent text: card-title inside card-head
    const titleEl = card.querySelector('.card-title');
    if (titleEl) {
      const t = collapseWhitespace(titleEl.textContent);
      if (t) return stripEmoji(t);
    }
    // Fall back to section header inside the card
    const sectionEl = card.querySelector('.section-hdr-title-zh');
    if (sectionEl) {
      const t = collapseWhitespace(sectionEl.textContent);
      if (t) return t;
    }
    // Last resort: aria-label or first heading
    const aria = card.getAttribute('aria-label');
    if (aria) return aria;
    const h = card.querySelector('h1,h2,h3,h4');
    if (h) return collapseWhitespace(h.textContent);
    return null;
  }

  function stripEmoji(s) {
    // Remove leading emoji icons like 🚇, 🟩, ⭐, 🌀 so the nav reads cleanly
    // This is a best-effort: drop leading chars in the emoji/symbol ranges
    return s.replace(/^[\p{Extended_Pictographic}\p{Symbol}\u2700-\u27BF]+\s*/u, '').trim();
  }

  function collapseWhitespace(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function renderEmpty() {
    listEl.innerHTML = '<div class="qnav-empty">此頁面沒有可跳轉的卡片</div>';
  }

  function renderList(cards, page) {
    const frag = document.createDocumentFragment();
    cards.forEach(function(c, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qnav-item';
      btn.dataset.target = c.id;

      const num = document.createElement('span');
      num.className = 'qnav-item-num';
      num.textContent = String(i + 1);

      const text = document.createElement('span');
      text.className = 'qnav-item-text';
      text.textContent = c.title;

      btn.appendChild(num);
      btn.appendChild(text);

      btn.addEventListener('click', function() {
        jumpTo(c.id, btn);
      });

      frag.appendChild(btn);
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function jumpTo(id, btn) {
    const target = document.getElementById(id);
    if (!target) return;

    // Mark active in the list
    listEl.querySelectorAll('.qnav-item.is-active').forEach(function(el) {
      el.classList.remove('is-active');
    });
    if (btn) btn.classList.add('is-active');

    // Close the panel first so the user sees the jump clearly
    close();

    // Wait for the slide-out transition before scrolling
    setTimeout(function() {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Trigger flash highlight
      target.classList.remove('qnav-flash');
      // force reflow so the animation restarts
      void target.offsetWidth;
      target.classList.add('qnav-flash');
      setTimeout(function() { target.classList.remove('qnav-flash'); }, 1700);
    }, 80);
  }

  /* Expose API */
  window.QuickNav = {
    rebuild: rebuild,
    open: open,
    close: close,
    toggle: toggle
  };

  /* Hook into page changes: rebuild when a page becomes active.
     The showPage() in core.js is wrapped by app.js, so we observe
     the DOM mutation on the .page.active class instead. We also
     schedule a delayed rebuild to pick up cards whose data
     renders asynchronously (weather, transport, etc.).            */
  let rebuildTimer = null;
  function onPageChanged() {
    rebuild();
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 1500);
    setTimeout(rebuild, 3500);
  }
  const pageObserver = new MutationObserver(function(muts) {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList && el.classList.contains('page') && el.classList.contains('active')) {
          onPageChanged();
          break;
        }
      }
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.page').forEach(function(p) {
      pageObserver.observe(p, { attributes: true, attributeFilter: ['class'] });
    });
  });
})();
