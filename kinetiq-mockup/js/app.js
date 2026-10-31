/*
 * Kinetiq Ortho mock-up app. Vanilla JS, no network calls except loading
 * data/catalog.json from this same site.
 *
 * PRIVACY RULES FOLLOWED IN THIS FILE:
 *  - Patient-related input (search text, reference, size, side) lives ONLY in
 *    the in-memory `state` object. It is never written to the URL, query string,
 *    hash, localStorage, sessionStorage, cookies, or the console.
 *  - The only thing ever placed in the URL hash is a product id (#/product/<id>).
 *  - Card fields are a TEST MODE placeholder; nothing is transmitted anywhere.
 */
(function () {
  'use strict';
  var M = window.KinetiqMatcher;

  var state = {
    catalog: [],
    search: null,          // { query, parsed, results, strong } — memory only
    order: null,           // { productId, size, qty, ref, side } — memory only
    step: 'details',       // details | checkout | confirmed
    confirmation: null,    // { orderNo, productName, size, qty, total }
    filter: 'all'
  };

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2); }
  function byId(id) { return state.catalog.filter(function (p) { return p.id === id; })[0] || null; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var ICONS = {
    knee: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 4v20c0 4 2 7 6 8s6 4 6 8v20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="18" y="22" width="28" height="20" rx="8" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="32" r="3" fill="currentColor"/><circle cx="46" cy="32" r="3" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="27" y="6" width="10" height="7" rx="2"/><rect x="27" y="16" width="10" height="7" rx="2"/><rect x="27" y="26" width="10" height="7" rx="2"/><rect x="27" y="36" width="10" height="7" rx="2"/><rect x="27" y="46" width="10" height="7" rx="2"/></g><path d="M12 28h40v18H12z" fill="none" stroke="currentColor" stroke-width="3" rx="6"/></svg>',
    neck: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 34c0-4 7-6 16-6s16 2 16 6v8c0 4-7 6-16 6s-16-2-16-6z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M14 58c4-6 10-8 18-8s14 2 18 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    wrist: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 60V36l-6-10c-2-3 2-6 4-3l6 8V10c0-3 5-3 5 0v16-20c0-3 5-3 5 0v20-16c0-3 5-3 5 0v18-12c0-3 5-3 5 0v24c0 6-3 10-6 12v14" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><rect x="18" y="40" width="28" height="12" rx="4" fill="currentColor" opacity=".35"/></svg>',
    ankle: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 4v34c0 4-2 6-6 8l-8 4c-3 2-2 8 2 8h40c4 0 5-4 3-6l-12-8c-3-2-5-4-5-8V4" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="22" width="22" height="16" rx="4" fill="currentColor" opacity=".35"/></svg>',
    shoulder: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="20" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 60V32c0-6 5-10 12-10h8c6 0 10 4 12 8l6 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 38l26 4M24 50l26-8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'
  };
  function icon(cat) { return ICONS[cat] || ICONS.knee; }

  // ---------- Privacy panel (rendered into both mini + full) ----------
  var PRIVACY_HTML =
    '<p class="demo-note">This mock-up uses no real PHI. Do not enter real patient information. Nothing you type is sent anywhere.</p>' +
    '<h3>What this demo already does</h3><ul>' +
    '<li><b>Minimum necessary:</b> the order form only asks for patient initials or an internal reference number, size and side. No names, dates of birth, SSNs, addresses or insurance IDs.</li>' +
    '<li><b>No PHI in URLs:</b> search text and order details are kept in page memory, never in the address bar, query strings or hash. The URL only ever contains a product id.</li>' +
    '<li><b>No PHI in logs or storage:</b> nothing is written to the browser console, cookies, localStorage or sessionStorage. Refreshing the page clears it.</li>' +
    '<li><b>No payment data transmitted:</b> checkout is a TEST MODE placeholder; card fields never leave the page.</li></ul>' +
    '<h3>Required before production <span class="placeholder-tag">PLACEHOLDER</span></h3><ul>' +
    '<li><b>HTTPS everywhere</b> (TLS 1.2+, HSTS) for the site, APIs and any voice/AI endpoints.</li>' +
    '<li><b>Signed Business Associate Agreements (BAAs)</b> with the hosting provider, payment processor, voice/speech vendor, AI provider, email and analytics vendors that could touch PHI.</li>' +
    '<li><b>Encryption at rest</b> for databases, backups and file storage (e.g. AES-256, managed keys).</li>' +
    '<li><b>Access logging &amp; audit trails</b> for every view/change of order records, with role-based access, MFA and log retention per policy.</li>' +
    '<li><b>Server-side logging hygiene:</b> scrub request bodies and identifiers from application, CDN and error-tracking logs.</li>' +
    '<li><b>Voice input:</b> browser speech recognition may send audio to the browser vendor. Production should use a BAA-covered voice service via <code>startGrokVoice()</code>.</li>' +
    '<li>Risk assessment, breach-notification plan, workforce training and a written privacy policy.</li></ul>';

  // ---------- Voice ----------
  /**
   * Grok voice integration point.
   * The mic button routes through this single hook. Today it uses the browser
   * Web Speech API as a stand-in. Replace the body with a call to a BAA-covered
   * Grok voice service in production; keep the same callback contract:
   *   handlers.onStart(), handlers.onText(text, isFinal), handlers.onEnd(), handlers.onError(message)
   * Returns an object with stop(), or null if voice input is unavailable.
   */
  function startGrokVoice(handlers) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      handlers.onError('Voice input isn\'t supported in this browser. Try Chrome, Edge or Safari, or just type your request.');
      return null;
    }
    var rec;
    try { rec = new SR(); } catch (e) { handlers.onError('Voice input couldn\'t start. Please type your request.'); return null; }
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onstart = function () { handlers.onStart(); };
    rec.onresult = function (ev) {
      var text = '', isFinal = false;
      for (var i = 0; i < ev.results.length; i++) { text += ev.results[i][0].transcript; if (ev.results[i].isFinal) isFinal = true; }
      handlers.onText(text, isFinal);
    };
    rec.onerror = function (ev) {
      var msg = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
        ? 'Microphone access was blocked. Allow the mic in your browser settings, or type your request.'
        : ev.error === 'no-speech' ? 'Didn\'t catch that. Tap the mic and try again.'
        : 'Voice input stopped (' + ev.error + '). You can type your request instead.';
      handlers.onError(msg);
    };
    rec.onend = function () { handlers.onEnd(); };
    try { rec.start(); } catch (e) { handlers.onError('Voice input couldn\'t start. Please type your request.'); return null; }
    return { stop: function () { try { rec.stop(); } catch (e) { /* ignore */ } } };
  }
  window.startGrokVoice = startGrokVoice; // exposed so a real integration can be swapped in

  var voiceSession = null;
  function setupVoice() {
    var btn = $('#mic-btn'), status = $('#voice-status'), input = $('#prompt-input');
    function setStatus(msg, warn) { status.textContent = msg || ''; status.classList.toggle('warn', !!warn); }
    function stopUi() { btn.classList.remove('listening'); btn.setAttribute('aria-pressed', 'false'); voiceSession = null; }
    btn.addEventListener('click', function () {
      if (voiceSession) { voiceSession.stop(); return; }
      voiceSession = startGrokVoice({
        onStart: function () { btn.classList.add('listening'); btn.setAttribute('aria-pressed', 'true'); setStatus('Listening… describe the patient and condition.'); },
        onText: function (text, isFinal) {
          input.value = text;
          if (isFinal) { setStatus('Got it. Searching…'); runSearch(text); }
        },
        onEnd: function () { stopUi(); if (/Listening/.test(status.textContent)) setStatus(''); },
        onError: function (msg) { stopUi(); setStatus(msg, true); }
      });
    });
  }

  // ---------- Search / results ----------
  function runSearch(query) {
    query = String(query || '').trim();
    if (!query) { $('#prompt-input').focus(); return; }
    var r = M.search(query, state.catalog, { max: 5, min: 3 });
    state.search = { query: query, parsed: r.parsed, results: r.results, strong: r.strong };
    renderResults();
    var res = $('#results');
    if (res.scrollIntoView) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function parsedChips(p) {
    var items = [];
    if (p.age != null) items.push('Age <b>' + esc(p.age) + '</b>');
    if (p.sex) items.push('Sex <b>' + esc(p.sex) + '</b>');
    if (p.heightIn != null) items.push('Height <b>' + Math.floor(p.heightIn / 12) + '\'' + (p.heightIn % 12) + '"</b>');
    if (p.weightLb != null) items.push('Weight <b>' + esc(p.weightLb) + ' lb</b>');
    if (p.frame) items.push('Frame <b>' + esc(p.frame) + '</b>');
    p.areas.forEach(function (a) { items.push('Area <b>' + esc(a) + '</b>'); });
    if (!items.length) return '';
    return '<ul class="parsed" aria-label="What we understood">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  }

  function cardHtml(p, opts) {
    opts = opts || {};
    var rec = opts.recommendedSize;
    var sizes = p.sizes.map(function (s) {
      var isRec = rec && s.label === rec;
      return '<span class="size-pill' + (isRec ? ' rec' : '') + '" title="' + esc(s.fit) + '">' + esc(s.label) + (isRec ? ' ✓ Recommended' : '') + '</span>';
    }).join('');
    var specs = Object.keys(p.specs || {}).slice(0, 3).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(p.specs[k]) + '</dd>'; }).join('');
    var badge = opts.top ? '<span class="badge badge-top">Best match</span>' : opts.related ? '<span class="badge badge-related">Related</span>' : '';
    return '<article class="card' + (opts.top ? ' top' : '') + '">' + badge +
      '<div class="card-media">' + icon(p.category) + '</div>' +
      '<div class="card-body">' +
        '<span class="badge">' + esc(cap(p.category)) + '</span>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<ul>' + p.indications.slice(0, 3).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
        '<dl class="specs">' + specs + '</dl>' +
        '<div class="sizes" aria-label="Available sizes">' + sizes + '</div>' +
        (opts.why ? '<p class="why">' + esc(opts.why) + '</p>' : '') +
      '</div>' +
      '<div class="card-foot"><div><div class="price">' + money(p.price) + '</div><div class="hcpcs">HCPCS ' + esc(p.hcpcs) + '</div></div>' +
        '<button type="button" class="btn btn-primary" data-open="' + esc(p.id) + '"' + (rec ? ' data-size="' + esc(rec) + '"' : '') + '>Select &amp; order</button></div>' +
    '</article>';
  }

  function renderResults() {
    var el = $('#results');
    var s = state.search;
    if (!s) { el.innerHTML = ''; return; }
    var head = '<div class="results-head"><h2>' + (s.strong ? 'Top matches' : 'No strong match') + '</h2>' +
      '<button type="button" class="btn btn-ghost" id="clear-search">Clear search</button></div>' + parsedChips(s.parsed);
    if (!s.strong) {
      el.innerHTML = head + '<div class="empty"><h2>We couldn\'t find a confident match.</h2>' +
        '<p class="muted">Try naming the body area and condition, e.g. "knee, meniscus tear" or "ankle sprain, 5\'6&quot;, 150 lb".</p>' +
        '<p><a class="btn btn-ghost" href="#/catalog">Browse the full catalog</a></p></div>' +
        (s.results.length ? '<h3 style="margin-top:20px">Possibly related</h3><div class="grid">' + s.results.map(function (r) { return cardHtml(r.product, { recommendedSize: r.recommendedSize, why: r.why, related: true }); }).join('') + '</div>' : '');
      return;
    }
    el.innerHTML = head + '<div class="grid">' + s.results.map(function (r, i) {
      return cardHtml(r.product, { recommendedSize: r.recommendedSize, why: r.why, top: i === 0, related: r.related });
    }).join('') + '</div>';
  }

  // ---------- Catalog ----------
  function renderCatalog() {
    var cats = ['all'].concat(state.catalog.map(function (p) { return p.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    $('#catalog-filters').innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip" data-filter="' + esc(c) + '" aria-pressed="' + (state.filter === c) + '">' + esc(c === 'all' ? 'All' : cap(c)) + '</button>';
    }).join('');
    var list = state.catalog.filter(function (p) { return state.filter === 'all' || p.category === state.filter; });
    $('#catalog-grid').innerHTML = list.map(function (p) { return cardHtml(p, {}); }).join('');
  }

  // ---------- Product / order ----------
  function openProduct(id, size) {
    var p = byId(id);
    if (!p) return;
    // Recommended size comes from the in-memory search (never from the URL)
    if (!size && state.search) {
      var hit = state.search.results.filter(function (r) { return r.product.id === id; })[0];
      if (hit) size = hit.recommendedSize;
    }
    state.order = { productId: id, size: size || null, recommended: size || null, qty: 1, ref: '', side: '' };
    state.step = 'details';
    state.confirmation = null;
    if (location.hash !== '#/product/' + id) location.hash = '#/product/' + id; // product id only
    else route();
  }

  function needsSide(p) { return ['knee', 'wrist', 'ankle', 'shoulder'].indexOf(p.category) >= 0; }

  function renderProduct(id) {
    var p = byId(id);
    var root = $('#product-root');
    if (!p) { root.innerHTML = '<div class="empty"><h2>Product not found</h2><p><a href="#/catalog">Back to catalog</a></p></div>'; return; }
    if (!state.order || state.order.productId !== id) state.order = { productId: id, size: null, recommended: null, qty: 1, ref: '', side: '' };
    var o = state.order;
    var back = '<button type="button" class="back-link" data-back>&larr; Back' + (state.search ? ' to results' : '') + '</button>';

    if (state.step === 'confirmed' && state.confirmation) { root.innerHTML = back + confirmationHtml(); return; }

    var specs = Object.keys(p.specs).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(p.specs[k]) + '</dd>'; }).join('');
    var sizeRows = p.sizes.map(function (s) { return '<tr><td>' + esc(s.label) + (o.recommended === s.label ? ' <span class="size-pill rec">Recommended</span>' : '') + '</td><td>' + esc(s.fit) + '</td></tr>'; }).join('');
    var details = '<div class="panel">' +
      '<div class="product-hero"><div class="card-media">' + icon(p.category) + '</div><div><span class="badge">' + esc(cap(p.category)) + '</span><h1>' + esc(p.name) + '</h1></div></div>' +
      '<h2>Indications</h2><ul>' + p.indications.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<h2>Specifications</h2><dl class="specs">' + specs + '<dt>HCPCS</dt><dd>' + esc(p.hcpcs) + '</dd></dl>' +
      '<h2 style="margin-top:16px">Sizing</h2><table class="summary"><tbody>' + sizeRows + '</tbody></table>' +
      '<p class="price">' + money(p.price) + ' <span class="muted small">per unit</span></p></div>';

    var right = state.step === 'checkout' ? checkoutHtml(p) : orderFormHtml(p);
    root.innerHTML = back + '<div class="product-layout">' + details + right + '</div>';
    if (state.step === 'checkout') bindCheckout(p); else bindOrderForm(p);
  }

  function orderFormHtml(p) {
    var o = state.order;
    var sizeOpts = '<option value="">Choose a size…</option>' + p.sizes.map(function (s) {
      return '<option value="' + esc(s.label) + '"' + (o.size === s.label ? ' selected' : '') + '>' + esc(s.label) + ' (' + esc(s.fit) + ')' + (o.recommended === s.label ? ' — recommended' : '') + '</option>';
    }).join('');
    var sides = needsSide(p) ? ['Left', 'Right', 'Bilateral'] : ['N/A (midline)'];
    if (!needsSide(p)) o.side = 'N/A (midline)';
    var sideHtml = sides.map(function (sd) {
      return '<label><input type="radio" name="side" value="' + esc(sd) + '"' + (o.side === sd ? ' checked' : '') + '> ' + esc(sd) + '</label>';
    }).join('');
    return '<form class="panel" id="order-form" novalidate autocomplete="off">' +
      '<h2>Order details</h2>' +
      '<p class="notice notice-info">Minimum necessary only: enter initials or your internal reference number. Do not enter names, birthdates, SSNs or addresses.</p>' +
      '<div class="field"><label for="f-ref">Patient initials or internal ref #</label>' +
        '<input id="f-ref" name="ref" maxlength="12" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. JD or REF-1042" value="' + esc(o.ref) + '">' +
        '<span class="help">2–12 letters, numbers or dashes. No spaces.</span><span class="error" id="e-ref"></span></div>' +
      '<div class="field"><label for="f-size">Size</label><select id="f-size" name="size">' + sizeOpts + '</select><span class="error" id="e-size"></span></div>' +
      '<fieldset class="field"><legend>Side</legend><div class="seg">' + sideHtml + '</div><span class="error" id="e-side"></span></fieldset>' +
      '<div class="field"><label for="f-qty">Quantity</label><input id="f-qty" name="qty" type="number" min="1" max="10" inputmode="numeric" value="' + esc(o.qty) + '"><span class="error" id="e-qty"></span></div>' +
      '<table class="summary"><tbody><tr><td>Unit price</td><td>' + money(p.price) + '</td></tr><tr class="total"><td>Total</td><td id="o-total">' + money(p.price * o.qty) + '</td></tr></tbody></table>' +
      '<button class="btn btn-primary btn-block" type="submit">Continue to checkout</button>' +
    '</form>';
  }

  function bindOrderForm(p) {
    var form = $('#order-form');
    var o = state.order;
    form.addEventListener('input', function () {
      var q = parseInt($('#f-qty').value, 10);
      $('#o-total').textContent = money(p.price * (q > 0 ? Math.min(q, 10) : 1));
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ref = $('#f-ref').value.trim().toUpperCase();
      var size = $('#f-size').value;
      var sideEl = form.querySelector('input[name="side"]:checked');
      var qty = parseInt($('#f-qty').value, 10);
      var ok = true;
      function err(id, msg) { $('#' + id).textContent = msg || ''; if (msg) ok = false; }
      err('e-ref', /^[A-Z0-9-]{2,12}$/.test(ref) ? '' : 'Use initials or a reference number only (2–12 characters, no spaces).');
      err('e-size', size ? '' : 'Choose a size.');
      err('e-side', sideEl ? '' : 'Choose a side.');
      err('e-qty', qty >= 1 && qty <= 10 ? '' : 'Quantity must be 1–10.');
      if (!ok) { var first = form.querySelector('.error:not(:empty)'); if (first && first.previousElementSibling) { var f = first.parentNode.querySelector('input,select'); if (f) f.focus(); } return; }
      o.ref = ref; o.size = size; o.side = sideEl.value; o.qty = qty;
      state.step = 'checkout';
      renderProduct(p.id);
      window.scrollTo(0, 0);
    });
  }

  function checkoutHtml(p) {
    var o = state.order;
    var total = p.price * o.qty;
    return '<form class="panel" id="pay-form" novalidate autocomplete="off">' +
      '<div class="test-banner"><span class="tag">TEST MODE</span> TEST MODE – no real payment</div>' +
      '<h2>Checkout</h2>' +
      '<table class="summary"><tbody>' +
        '<tr><td>' + esc(p.name) + '</td><td>' + money(p.price) + '</td></tr>' +
        '<tr><td>Size / side</td><td>' + esc(o.size) + ' / ' + esc(o.side) + '</td></tr>' +
        '<tr><td>Patient ref</td><td>' + esc(o.ref) + '</td></tr>' +
        '<tr><td>Quantity</td><td>' + esc(o.qty) + '</td></tr>' +
        '<tr class="total"><td>Total</td><td>' + money(total) + '</td></tr></tbody></table>' +
      '<div class="field"><label for="c-num">Card information</label>' +
        '<div class="stripe-el">' +
          '<div class="card-brand-row"><input id="c-num" inputmode="numeric" autocomplete="off" placeholder="1234 1234 1234 1234" maxlength="19" aria-describedby="c-help"><span class="card-brand" id="c-brand" aria-hidden="true"></span></div>' +
          '<div class="split"><input id="c-exp" inputmode="numeric" autocomplete="off" placeholder="MM / YY" maxlength="7" aria-label="Expiration date"><input id="c-cvc" inputmode="numeric" autocomplete="off" placeholder="CVC" maxlength="4" aria-label="CVC"></div>' +
        '</div>' +
        '<span class="help" id="c-help">Use test card 4242 4242 4242 4242, any future date, any CVC.</span><span class="error" id="e-card" role="alert"></span></div>' +
      '<button class="btn btn-primary btn-block" type="submit" id="pay-btn">Pay ' + money(total) + ' (test)</button>' +
      '<button class="btn btn-ghost btn-block" type="button" id="edit-order" style="margin-top:10px">Edit order</button>' +
      '<p class="powered">Stripe-style placeholder. No keys, no network calls, nothing is charged.</p>' +
    '</form>';
  }

  function bindCheckout(p) {
    var num = $('#c-num'), exp = $('#c-exp'), cvc = $('#c-cvc');
    num.addEventListener('input', function () {
      var d = num.value.replace(/\D/g, '').slice(0, 16);
      num.value = d.replace(/(\d{4})(?=\d)/g, '$1 ');
      $('#c-brand').textContent = /^4/.test(d) ? 'VISA' : /^5[1-5]/.test(d) ? 'MC' : /^3[47]/.test(d) ? 'AMEX' : '';
    });
    exp.addEventListener('input', function () {
      var d = exp.value.replace(/\D/g, '').slice(0, 4);
      exp.value = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d;
    });
    cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
    $('#edit-order').addEventListener('click', function () { state.step = 'details'; renderProduct(p.id); });
    $('#pay-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var e = $('#e-card');
      var d = num.value.replace(/\D/g, '');
      var m = exp.value.replace(/\D/g, '');
      var c = cvc.value;
      if (d !== '4242424242424242') { e.textContent = d.length < 16 ? 'Your card number is incomplete.' : 'TEST MODE: only the test card 4242 4242 4242 4242 is accepted.'; num.focus(); return; }
      var mm = parseInt(m.slice(0, 2), 10), yy = parseInt(m.slice(2, 4), 10);
      var now = new Date(), cy = now.getFullYear() % 100, cm = now.getMonth() + 1;
      if (m.length !== 4 || !(mm >= 1 && mm <= 12)) { e.textContent = 'Your card\'s expiration date is incomplete.'; exp.focus(); return; }
      if (yy < cy || (yy === cy && mm < cm)) { e.textContent = 'Your card\'s expiration year is in the past.'; exp.focus(); return; }
      if (!/^\d{3,4}$/.test(c)) { e.textContent = 'Your card\'s security code is incomplete.'; cvc.focus(); return; }
      e.textContent = '';
      var btn = $('#pay-btn'); btn.disabled = true; btn.textContent = 'Processing (test)…';
      // Simulated processing delay. NO network request is made.
      setTimeout(function () {
        var o = state.order;
        state.confirmation = {
          orderNo: 'KO-TEST-' + Date.now().toString(36).toUpperCase().slice(-5) + '-' + Math.floor(1000 + Math.random() * 9000),
          productName: p.name, size: o.size, side: o.side, qty: o.qty, ref: o.ref, total: p.price * o.qty
        };
        // Card fields are discarded; they were never stored in state.
        state.step = 'confirmed';
        renderProduct(p.id);
        window.scrollTo(0, 0);
      }, 900);
    });
  }

  function confirmationHtml() {
    var c = state.confirmation;
    return '<div class="panel confirm" role="status">' +
      '<div class="check"><svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>' +
      '<div class="test-banner" style="justify-content:center"><span class="tag">TEST MODE</span> No real payment was taken</div>' +
      '<h1>Order confirmed</h1><p class="muted">Fake order number</p><div class="order-no">' + esc(c.orderNo) + '</div>' +
      '<table class="summary" style="max-width:420px;margin:0 auto 16px;text-align:left"><tbody>' +
        '<tr><td>Product</td><td>' + esc(c.productName) + '</td></tr>' +
        '<tr><td>Size / side</td><td>' + esc(c.size) + ' / ' + esc(c.side) + '</td></tr>' +
        '<tr><td>Patient ref</td><td>' + esc(c.ref) + '</td></tr>' +
        '<tr><td>Quantity</td><td>' + esc(c.qty) + '</td></tr>' +
        '<tr class="total"><td>Total (test)</td><td>' + money(c.total) + '</td></tr></tbody></table>' +
      '<p class="small muted">In production, a confirmation would be sent via a BAA-covered channel. This mock-up sends nothing.</p>' +
      '<button type="button" class="btn btn-primary" id="new-order">Start a new search</button></div>';
  }

  // ---------- Router (hash holds only a view name or product id) ----------
  function showView(name) {
    ['home', 'catalog', 'product', 'privacy'].forEach(function (v) { $('#view-' + v).hidden = v !== name; });
    $all('.site-nav a').forEach(function (a) { a.removeAttribute('aria-current'); });
  }
  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/product\/([a-z0-9-]+)$/);
    closeNav();
    if (m) { showView('product'); renderProduct(m[1]); return; }
    // Leaving the product view drops any un-submitted order data from memory
    if (state.order && state.step !== 'confirmed') { state.order = null; state.step = 'details'; }
    if (h === '#/catalog') { showView('catalog'); renderCatalog(); mark('catalog'); window.scrollTo(0, 0); return; }
    if (h === '#/privacy') { showView('privacy'); mark('privacy'); window.scrollTo(0, 0); return; }
    showView('home');
    renderResults();
    if (h === '#/how' || h === '#/contact') {
      mark(h.slice(2));
      var t = document.getElementById(h.slice(2));
      if (t) setTimeout(function () { t.scrollIntoView({ behavior: 'smooth' }); }, 0);
    }
  }
  function mark(name) { var a = $('.site-nav a[data-nav="' + name + '"]'); if (a) a.setAttribute('aria-current', 'page'); }
  function closeNav() { $('#site-nav').classList.remove('open'); $('.nav-toggle').setAttribute('aria-expanded', 'false'); }

  // ---------- Wiring ----------
  function bindGlobal() {
    $('#search-form').addEventListener('submit', function (ev) { ev.preventDefault(); runSearch($('#prompt-input').value); });
    $('#prompt-input').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); runSearch(this.value); }
    });
    $all('.chips .chip').forEach(function (c) {
      c.addEventListener('click', function () { $('#prompt-input').value = c.textContent; runSearch(c.textContent); });
    });
    $('.nav-toggle').addEventListener('click', function () {
      var nav = $('#site-nav'); var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open); this.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target : null; if (!t) return;
      var open = t.closest('[data-open]');
      if (open) { openProduct(open.getAttribute('data-open'), open.getAttribute('data-size')); return; }
      var f = t.closest('[data-filter]');
      if (f) { state.filter = f.getAttribute('data-filter'); renderCatalog(); return; }
      if (t.closest('[data-back]')) {
        if (state.step === 'confirmed') { state.order = null; state.confirmation = null; state.step = 'details'; }
        location.hash = state.search ? '#/' : '#/catalog'; return;
      }
      if (t.closest('#clear-search')) { state.search = null; $('#prompt-input').value = ''; renderResults(); $('#prompt-input').focus(); return; }
      if (t.closest('#new-order')) {
        state.order = null; state.confirmation = null; state.step = 'details'; state.search = null;
        $('#prompt-input').value = ''; location.hash = '#/'; setTimeout(function () { $('#prompt-input').focus(); }, 0); return;
      }
    });
    window.addEventListener('hashchange', route);
  }

  function init() {
    $('#privacy-panel-mini').innerHTML = PRIVACY_HTML;
    $('#privacy-panel-full').innerHTML = PRIVACY_HTML;
    bindGlobal();
    setupVoice();
    fetch('data/catalog.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { state.catalog = Array.isArray(data) ? data : (data.products || []); route(); })
      .catch(function () {
        $('#results').innerHTML = '<div class="empty"><h2>Catalog couldn\'t load</h2><p class="muted">Serve this folder over HTTP (see README) so <code>data/catalog.json</code> can be fetched. Opening index.html directly from disk blocks fetch in most browsers.</p></div>';
        route();
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
