/* ==========================================================================
   Halali — enhancements.js
   Loaded after app.js. Wrapped in an IIFE so nothing here can collide with
   app.js's top-level consts, even by accident. Every feature below fails
   quietly (no console spam, no thrown errors) if its markup isn't present,
   so this file is also safe to reuse on secondary pages like 404.html.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */
  function on(el, evt, fn, opts) {
    if (el) el.addEventListener(evt, fn, opts);
  }
  function qs(sel, scope) {
    return (scope || doc).querySelector(sel);
  }
  function qsa(sel, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(sel));
  }

  /* ------------------------------------------------------------------
     1. Dark mode toggle
     The attribute itself is already set before paint by the tiny inline
     script in <head>; here we just wire up the control and persistence.
     ------------------------------------------------------------------ */
  (function themeToggle() {
    var toggles = qsa('[data-theme-toggle]');
    if (!toggles.length) return;

    function isDark() {
      return root.getAttribute('data-theme') === 'dark';
    }
    function reflect() {
      var dark = isDark();
      toggles.forEach(function (btn) {
        btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        var state = qs('[data-theme-toggle-state]', btn);
        if (state) state.textContent = dark ? 'On' : 'Off';
      });
    }
    function setTheme(dark) {
      if (dark) {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
      try {
        localStorage.setItem('halaliTheme', dark ? 'dark' : 'light');
      } catch (e) {}
      reflect();
    }

    toggles.forEach(function (btn) {
      on(btn, 'click', function () {
        setTheme(!isDark());
        var moreMenu = qs('[data-more-menu]');
        if (moreMenu && !moreMenu.hidden) moreMenu.hidden = true;
      });
    });
    reflect();
  })();

  /* ------------------------------------------------------------------
     2. Sticky header shadow once scrolled + scroll progress bar +
        back-to-top visibility — all driven by one scroll listener.
     ------------------------------------------------------------------ */
  (function scrollEffects() {
    var header = qs('.site-header');
    var progressFill = qs('[data-scroll-progress]');
    var backToTop = qs('[data-back-to-top]');
    if (!header && !progressFill && !backToTop) return;

    var ticking = false;

    function update() {
      ticking = false;
      var scrollTop = window.scrollY || doc.documentElement.scrollTop;

      if (header) header.classList.toggle('is-scrolled', scrollTop > 4);

      if (progressFill) {
        var docHeight = doc.documentElement.scrollHeight - doc.documentElement.clientHeight;
        var ratio = docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0;
        progressFill.style.transform = 'scaleX(' + ratio + ')';
      }

      if (backToTop) backToTop.classList.toggle('is-visible', scrollTop > 600);
    }

    on(window, 'scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  })();

  (function backToTopClick() {
    var btn = qs('[data-back-to-top]');
    if (!btn) return;
    on(btn, 'click', function () {
      var top = qs('#top');
      if (top && top.scrollIntoView) {
        top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  })();

  /* ------------------------------------------------------------------
     3. Floating contact button
     ------------------------------------------------------------------ */
  (function contactFab() {
    var trigger = qs('[data-contact-trigger]');
    var panel = qs('[data-contact-panel]');
    if (!trigger || !panel) return;

    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }

    on(trigger, 'click', function (e) {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    on(doc, 'click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) close();
    });
    on(doc, 'keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        close();
        trigger.focus();
      }
    });
  })();

  /* ------------------------------------------------------------------
     4. Image fade-in-on-load
     ------------------------------------------------------------------ */
  (function imageFadeIn() {
    var images = qsa('img');
    images.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) return; // already loaded/cached
      img.classList.add('is-loading-img');
      var reveal = function () {
        img.classList.remove('is-loading-img');
        img.classList.add('is-loaded-img');
      };
      on(img, 'load', reveal);
      on(img, 'error', reveal);
    });
  })();

  /* ------------------------------------------------------------------
     5. Full site search
     ------------------------------------------------------------------ */
  (function siteSearch() {
    var overlay = qs('[data-search-overlay]');
    var input = qs('[data-search-input]');
    var results = qs('[data-search-results]');
    var triggers = qsa('[data-search-trigger]');
    if (!overlay || !input || !results || !triggers.length) return;

    var index = null;
    var debounceTimer = null;
    var activeIndex = -1;

    function buildIndex() {
      var list = [];
      var sections = [
        { title: 'Our story', desc: 'Rooted in place, made to share.', href: '#story' },
        { title: 'Menu', desc: 'Small plates, mains, drinks, sweets and brunch.', href: '#menu', isMenu: true },
        { title: 'Order online', desc: 'Delivery or pickup across Nairobi.', href: '#order' },
        { title: 'Experiences', desc: "Chef's table, private gatherings, and the Sunday table.", href: '#experience' },
        { title: 'Visit us', desc: 'Hours, address, and how to reach Halali.', href: '#visit' },
        { title: 'Good to know', desc: 'Frequently asked questions.', href: '#faq' },
        { title: 'Reserve a table', desc: 'Request a table for your next visit.', href: '#reserve' }
      ];
      sections.forEach(function (s) {
        list.push({ kind: 'Section', title: s.title, desc: s.desc, href: s.href, isMenu: !!s.isMenu });
      });

      qsa('.menu-grid .menu-card').forEach(function (card) {
        var name = qs('strong', card);
        var desc = qs('.dish-meta p', card);
        var price = qs('.dish-meta b', card);
        list.push({
          kind: 'Dish',
          title: name ? name.textContent.trim() : 'Dish',
          desc: [desc ? desc.textContent.trim() : '', price ? price.textContent.trim() : ''].filter(Boolean).join(' · '),
          href: '#menu',
          isMenu: true,
          card: card
        });
      });

      qsa('.faq-item').forEach(function (item) {
        var q = qs('.faq-question-text', item);
        var a = qs('.faq-answer-inner', item);
        list.push({
          kind: 'FAQ',
          title: q ? q.textContent.trim() : 'Question',
          desc: a ? a.textContent.trim() : '',
          href: '#faq',
          faqItem: item
        });
      });

      return list;
    }

    function render(matches, query) {
      results.innerHTML = '';
      if (!query) {
        results.innerHTML = '<p class="search-empty">Start typing to search dishes, sections and FAQs.</p>';
        return;
      }
      if (!matches.length) {
        var empty = doc.createElement('p');
        empty.className = 'search-empty';
        empty.textContent = 'No matches for "' + query + '". Try a dish name or a topic like "delivery".';
        results.appendChild(empty);
        return;
      }
      activeIndex = -1;
      matches.slice(0, 20).forEach(function (m) {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'search-result';
        btn.innerHTML = '<span class="search-result-kind">' + m.kind + '</span>' +
          '<span class="search-result-body"><strong></strong><span></span></span>';
        qs('strong', btn).textContent = m.title;
        qs('.search-result-body span', btn).textContent = m.desc;
        on(btn, 'click', function () { selectResult(m); });
        results.appendChild(btn);
      });
    }

    function search(query) {
      if (!index) index = buildIndex();
      var q = query.trim().toLowerCase();
      if (!q) return render([], '');
      var scored = index
        .map(function (item) {
          var title = item.title.toLowerCase();
          var desc = item.desc.toLowerCase();
          var score = -1;
          if (title.indexOf(q) === 0) score = 3;
          else if (title.indexOf(q) > -1) score = 2;
          else if (desc.indexOf(q) > -1) score = 1;
          return { item: item, score: score };
        })
        .filter(function (r) { return r.score > -1; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (r) { return r.item; });
      render(scored, query.trim());
    }

    function selectResult(item) {
      closeSearch();
      if (item.isMenu && typeof setMenuView === 'function') {
        try { setMenuView(true); } catch (e) {}
      }
      var target = qs(item.href);
      if (target && target.scrollIntoView) {
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 10);
      }
      if (item.faqItem) {
        window.setTimeout(function () { openFaqItem(item.faqItem); }, 350);
      }
      if (item.card) {
        window.setTimeout(function () {
          item.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          item.card.classList.add('is-search-hit');
          window.setTimeout(function () { item.card.classList.remove('is-search-hit'); }, 1600);
        }, 350);
      }
    }

    function openSearch() {
      overlay.hidden = false;
      doc.body.style.overflow = 'hidden';
      window.setTimeout(function () { input.focus(); }, 10);
      render([], '');
    }
    function closeSearch() {
      overlay.hidden = true;
      doc.body.style.overflow = '';
      input.value = '';
      var moreMenu = qs('[data-more-menu]');
      if (moreMenu && !moreMenu.hidden) moreMenu.hidden = true;
    }

    triggers.forEach(function (t) { on(t, 'click', openSearch); });
    qsa('[data-search-close]').forEach(function (el) { on(el, 'click', closeSearch); });

    on(input, 'input', function () {
      var value = input.value;
      results.innerHTML = '<div class="search-skeleton"><span></span><span></span><span></span></div>';
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function () { search(value); }, 200);
    });

    on(doc, 'keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) { closeSearch(); return; }
      var activeTag = doc.activeElement && doc.activeElement.tagName;
      var typing = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (doc.activeElement && doc.activeElement.isContentEditable);
      if (e.key === '/' && !typing && overlay.hidden) {
        e.preventDefault();
        openSearch();
      }
    });
  })();

  /* ------------------------------------------------------------------
     6. FAQ accordion
     ------------------------------------------------------------------ */
  function openFaqItem(item) {
    var btn = qs('.faq-question', item);
    item.setAttribute('data-open', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
  (function faqAccordion() {
    var items = qsa('.faq-item');
    if (!items.length) return;
    items.forEach(function (item) {
      var btn = qs('.faq-question', item);
      on(btn, 'click', function () {
        var isOpen = item.getAttribute('data-open') === 'true';
        item.setAttribute('data-open', isOpen ? 'false' : 'true');
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });
    });
  })();

  /* ------------------------------------------------------------------
     7. Newsletter success state
     Runs as a second submit listener, strictly after app.js's own
     handler (script order), so it only reacts to an already-accepted
     submission — it never re-implements or races that logic.
     ------------------------------------------------------------------ */
  (function newsletterSuccess() {
    var form = qs('#newsletter-form');
    var success = qs('[data-newsletter-success]');
    if (!form || !success) return;
    on(form, 'submit', function () {
      window.setTimeout(function () { success.hidden = false; }, 150);
    });
  })();

  /* ------------------------------------------------------------------
     8. Cookie banner
     ------------------------------------------------------------------ */
  (function cookieBanner() {
    var banner = qs('[data-cookie-banner]');
    var acceptBtn = qs('[data-cookie-accept]');
    if (!banner) return;

    var consent;
    try { consent = localStorage.getItem('halaliCookieConsent'); } catch (e) { consent = 'accepted'; }

    function setOffsetVar() {
      root.style.setProperty('--cookie-banner-h', banner.offsetHeight + 'px');
    }

    if (consent !== 'accepted') {
      window.setTimeout(function () {
        banner.hidden = false;
        doc.body.classList.add('cookie-banner-visible');
        window.requestAnimationFrame(function () {
          setOffsetVar();
          window.requestAnimationFrame(function () { banner.classList.add('is-visible'); });
        });
      }, 700);
    }

    on(acceptBtn, 'click', function () {
      try { localStorage.setItem('halaliCookieConsent', 'accepted'); } catch (e) {}
      banner.classList.remove('is-visible');
      doc.body.classList.remove('cookie-banner-visible');
      window.setTimeout(function () { banner.hidden = true; }, 350);
    });

    on(window, 'resize', function () {
      if (!banner.hidden) setOffsetVar();
    });
  })();

  /* ------------------------------------------------------------------
     9. Confirmation modal for destructive actions
     A capture-phase listener on `document` intercepts the click before
     it reaches the target button's own (bubble-phase) handler in
     app.js, so app.js never runs for that click. Confirming replays
     the exact same click once, bypassed, so app.js's original logic
     runs completely untouched — nothing here reimplements it.
     ------------------------------------------------------------------ */
  (function confirmModal() {
    var modal = qs('[data-confirm-modal]');
    if (!modal) return;
    var titleEl = qs('[data-confirm-title]', modal);
    var descEl = qs('[data-confirm-desc]', modal);
    var proceedBtn = qs('[data-confirm-proceed]', modal);
    var cancelBtn = qs('[data-confirm-cancel]', modal);
    var closeEls = qsa('[data-confirm-close]', modal);
    var bypass = null;
    var pendingBtn = null;

    function close() {
      modal.hidden = true;
      pendingBtn = null;
    }
    function open(btn) {
      pendingBtn = btn;
      titleEl.textContent = btn.dataset.confirmTitle || 'Are you sure?';
      descEl.textContent = btn.dataset.confirmDesc || "This action can't be undone.";
      proceedBtn.textContent = btn.dataset.confirmLabel || 'Confirm';
      modal.hidden = false;
    }

    doc.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-confirm-action]');
      if (!btn) return;
      if (bypass === btn) { bypass = null; return; }
      e.preventDefault();
      e.stopPropagation();
      open(btn);
    }, true);

    on(proceedBtn, 'click', function () {
      var btn = pendingBtn;
      close();
      if (btn) {
        bypass = btn;
        btn.click();
      }
    });
    on(cancelBtn, 'click', close);
    closeEls.forEach(function (el) { on(el, 'click', close); });
    on(doc, 'keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  })();

  /* ------------------------------------------------------------------
     10. Copy-to-clipboard chips + toast
     ------------------------------------------------------------------ */
  (function copyChips() {
    var toast = qs('[data-toast]');
    var toastTimer = null;

    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.hidden = false;
      window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('is-visible');
        window.setTimeout(function () { toast.hidden = true; }, 250);
      }, 2200);
    }

    on(doc, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('.copy-chip');
      if (!btn) return;
      var text = '';
      if (btn.dataset.copyTarget) {
        var targetEl = qs(btn.dataset.copyTarget);
        text = targetEl ? targetEl.textContent.trim() : '';
      } else {
        text = btn.dataset.copyValue || '';
      }
      if (!text) return;

      var done = function () {
        btn.classList.add('is-copied');
        showToast('Copied “' + text + '”');
        window.setTimeout(function () { btn.classList.remove('is-copied'); }, 1400);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          showToast('Could not copy — ' + text);
        });
      } else {
        done();
      }
    });
  })();

  /* ------------------------------------------------------------------
     11. UTM tracking on outbound links
     ------------------------------------------------------------------ */
  (function utmOutboundLinks() {
    var params = { utm_source: 'halali_site', utm_medium: 'referral', utm_campaign: 'outbound_link' };
    qsa('a[href^="http"]').forEach(function (link) {
      try {
        var url = new URL(link.href, window.location.href);
        if (url.hostname && url.hostname !== window.location.hostname) {
          Object.keys(params).forEach(function (key) {
            if (!url.searchParams.has(key)) url.searchParams.set(key, params[key]);
          });
          link.href = url.toString();
        }
      } catch (e) { /* malformed or unsupported URL — leave untouched */ }
    });
  })();

  /* ------------------------------------------------------------------
     12. Print — make sure lazy images are actually in the DOM/loaded
     before the browser renders the print layout.
     ------------------------------------------------------------------ */
  (function printReady() {
    on(window, 'beforeprint', function () {
      qsa('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
    });
  })();

})();
