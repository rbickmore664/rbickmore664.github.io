/*
 * Medicorp mock-up: client-side query parsing + product scoring.
 * Pure functions, no DOM, no network, no logging. Works in the browser
 * (window.KinetiqMatcher) and in Node (module.exports) for testing.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.KinetiqMatcher = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Body-area vocabulary used to detect which category the user means.
  var AREA_TERMS = {
    knee: ['knee', 'knees', 'acl', 'mcl', 'lcl', 'pcl', 'meniscus', 'meniscal', 'patella', 'patellar', 'patellofemoral', 'kneecap', 'tibial plateau', 'tkr', 'tka'],
    back: ['back', 'lumbar', 'lumbago', 'spine', 'spinal', 'disc', 'disk', 'sciatica', 'sacroiliac', 'si joint', 'thoracic', 'thoracolumbar', 'tlso', 'lso', 'vertebral', 'pelvic', 'pelvis'],
    neck: ['neck', 'cervical', 'whiplash', 'c-spine', 'acdf'],
    wrist: ['wrist', 'carpal', 'carpal tunnel', 'thumb', 'hand', 'scaphoid', 'de quervain', 'dequervain', 'cts'],
    ankle: ['ankle', 'achilles', 'foot', 'metatarsal', 'heel'],
    shoulder: ['shoulder', 'rotator', 'rotator cuff', 'labrum', 'labral', 'clavicle', 'humerus', 'arm sling']
  };

  var STOPWORDS = ['with', 'and', 'the', 'for', 'from', 'year', 'years', 'old', 'male', 'female', 'patient', 'pain', 'small', 'large', 'frame', 'about', 'after', 'needs'];

  function normalize(q) {
    return String(q || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/[\u201c\u201d\u2033]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function hasTerm(text, term) {
    var re = new RegExp('(^|[^a-z0-9])' + escapeRe(term.toLowerCase()) + '(?=$|[^a-z0-9])');
    return re.test(text);
  }

  /** Parse free text into structured patient/condition hints. */
  function parseQuery(raw) {
    var q = normalize(raw);
    var out = { text: q, age: null, sex: null, heightIn: null, weightLb: null, frame: null, areas: [] };
    var m;

    // Age: "40-year-old", "40 yo", "40 y/o", "age 40", "55F", "40 m"
    if ((m = q.match(/\b(\d{1,3})\s*-?\s*(?:years?|yrs?|yo|y\/o|y\.o\.?)\b/))) out.age = +m[1];
    else if ((m = q.match(/\bage[:\s]*(\d{1,3})\b/))) out.age = +m[1];
    if ((m = q.match(/\b(\d{1,3})\s*([mf])\b(?!')/))) {
      if (out.age === null) out.age = +m[1];
      out.sex = m[2] === 'f' ? 'female' : 'male';
    }
    if (out.age !== null && (out.age < 1 || out.age > 110)) out.age = null;

    // Sex words (female first: \bmale\b does not match "female" anyway)
    if (!out.sex) {
      if (/\b(female|woman|women|girl|lady|she|her)\b/.test(q)) out.sex = 'female';
      else if (/\b(male|man|men|boy|gentleman|he|his)\b/.test(q)) out.sex = 'male';
    }

    // Height: 5'10", 5' 10, 5 ft 10 in, 5ft, 178 cm, 70 in
    if ((m = q.match(/\b([3-7])\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2})\s*(?:"|''|in\b|inches\b)?)?/))) {
      var inch = m[2] ? +m[2] : 0;
      if (inch < 12) out.heightIn = (+m[1]) * 12 + inch;
    } else if ((m = q.match(/\b(1\d{2}|2[0-2]\d)\s*cm\b/))) {
      out.heightIn = Math.round(+m[1] / 2.54);
    } else if ((m = q.match(/\b([4-8]\d)\s*(?:in|inches)\b/))) {
      out.heightIn = +m[1];
    }

    // Weight: 200 lb / lbs / pounds, 90 kg
    if ((m = q.match(/\b(\d{2,3}(?:\.\d+)?)\s*(?:lb|lbs|pounds?|#)(?=$|[^a-z])/))) out.weightLb = Math.round(+m[1]);
    else if ((m = q.match(/\b(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/))) out.weightLb = Math.round(+m[1] * 2.2046);

    if (/\b(small|petite|slight|slim|thin)\s*(frame|build)?\b/.test(q) && /\b(small|petite)\b/.test(q)) out.frame = 'small';
    if (/\b(large|big|heavy)\s+(frame|build)\b/.test(q)) out.frame = 'large';

    Object.keys(AREA_TERMS).forEach(function (area) {
      if (AREA_TERMS[area].some(function (t) { return hasTerm(q, t); })) out.areas.push(area);
    });
    return out;
  }

  /** Pick the best size for a product from height/weight (or frame). Returns {label, reason} or null. */
  function recommendSize(product, parsed) {
    var sizes = product.sizes || [];
    if (!sizes.length) return null;
    if (sizes.length === 1) return { label: sizes[0].label, reason: 'one size fits most' };
    var h = parsed.heightIn, w = parsed.weightLb;
    if (h == null && w == null) {
      if (parsed.frame === 'small') return { label: sizes[0].label, reason: 'small frame' };
      if (parsed.frame === 'large') return { label: sizes[sizes.length - 1].label, reason: 'large frame' };
      return null;
    }
    function dist(v, range) {
      if (v == null || !range) return 0;
      if (v < range[0]) return range[0] - v;
      if (v > range[1]) return v - range[1];
      // inside the range: tiny penalty for distance from the centre to break overlaps
      return Math.abs(v - (range[0] + range[1]) / 2) / (range[1] - range[0] + 1) * 0.5;
    }
    var best = null;
    sizes.forEach(function (s) {
      // weight dominates fit for most braces; 1 in of height ~ 4 lb
      var score = dist(w, s.weightLb) + dist(h, s.heightIn) * 4;
      if (parsed.frame === 'small') score += sizes.indexOf(s) * 0.5;
      if (!best || score < best.score) best = { label: s.label, score: score };
    });
    var bits = [];
    if (h != null) bits.push(Math.floor(h / 12) + "'" + (h % 12) + '"');
    if (w != null) bits.push(w + ' lb');
    return { label: best.label, reason: 'based on ' + bits.join(', ') };
  }

  function keywordWeight(kw) { return kw.indexOf(' ') >= 0 || kw.indexOf('-') >= 0 ? 5 : 3; }

  /** Score one product against a parsed query. */
  function scoreProduct(product, parsed) {
    var q = parsed.text;
    var matched = [];
    var score = 0;
    (product.keywords || []).forEach(function (kw) {
      if (hasTerm(q, kw)) { score += keywordWeight(kw); matched.push(kw); }
    });
    // Light credit for query words appearing in the indications text
    var indText = (product.indications || []).join(' ').toLowerCase();
    var words = q.split(/[^a-z0-9']+/).filter(function (t) { return t.length >= 4 && STOPWORDS.indexOf(t) < 0; });
    var seen = {};
    words.forEach(function (t) { if (!seen[t] && hasTerm(indText, t)) { seen[t] = 1; score += 1; } });

    var areaMatch = parsed.areas.indexOf(product.category) >= 0;
    if (parsed.areas.length) {
      if (areaMatch) score += 10;
      else score = score * 0.25; // wrong body area: heavily demoted
    }
    return { score: Math.round(score * 10) / 10, matched: matched, areaMatch: areaMatch };
  }

  function whyLine(product, s, size) {
    var parts = [];
    if (s.areaMatch) parts.push(product.category + ' support');
    if (s.matched.length) parts.push('matches "' + s.matched.slice(0, 3).join('", "') + '"');
    if (size) parts.push('size ' + size.label + ' ' + size.reason);
    return parts.length ? 'Why this matches: ' + parts.join('; ') + '.' : 'Related product in the catalog.';
  }

  var STRONG = 12;   // a confident match (area + a condition keyword)
  var MINIMUM = 3;   // anything below is not shown

  /** Rank the catalog. Returns {parsed, results:[...], strong:boolean}. */
  function search(rawQuery, products, opts) {
    opts = opts || {};
    var max = opts.max || 5, min = opts.min || 3;
    var parsed = parseQuery(rawQuery);
    var scored = (products || []).map(function (p, i) {
      var s = scoreProduct(p, parsed);
      var size = recommendSize(p, parsed);
      return { product: p, score: s.score, matched: s.matched, areaMatch: s.areaMatch, recommendedSize: size ? size.label : null, sizeReason: size ? size.reason : null, why: whyLine(p, s, size), order: i };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    var results = scored.filter(function (r) { return r.score >= MINIMUM; }).slice(0, max);
    // If an area was named but few keywords hit, top up with same-area products to reach `min`
    if (results.length < min && parsed.areas.length) {
      scored.forEach(function (r) {
        if (results.length < min && r.areaMatch && results.indexOf(r) < 0) results.push(r);
      });
    }
    // Still short? Add the next-best related items (any keyword overlap), flagged as related
    if (results.length < min && results.length > 0) {
      scored.forEach(function (r) {
        if (results.length < min && r.score > 0 && results.indexOf(r) < 0) {
          r.related = true;
          r.why = 'Related option (different body area' + (r.matched.length ? ', shares "' + r.matched[0] + '"' : '') + ').';
          results.push(r);
        }
      });
    }
    var strong = results.length > 0 && results[0].score >= STRONG;
    return { parsed: parsed, results: results, strong: strong };
  }

  return { parseQuery: parseQuery, recommendSize: recommendSize, scoreProduct: scoreProduct, search: search, normalize: normalize, STRONG: STRONG };
});
