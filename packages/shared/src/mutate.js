import { mulberry32 } from './stats.js';

const CPP_TWO = ['<=', '>=', '==', '!=', '&&', '||'];
const REPLACE = {
  '<': ['<=', 'ROR'],
  '<=': ['<', 'ROR'],
  '>': ['>=', 'ROR'],
  '>=': ['>', 'ROR'],
  '==': ['!=', 'ROR'],
  '!=': ['==', 'ROR'],
  '+': ['-', 'AOR'],
  '-': ['+', 'AOR'],
  '*': ['+', 'AOR'],
  '&&': ['||', 'LOR'],
  '||': ['&&', 'LOR'],
  and: ['or', 'LOR'],
  or: ['and', 'LOR'],
};

/** Positions of code (outside string literals and comments) on one line. */
function codeSpans(line, lang) {
  const spans = [];
  let i = 0;
  let quote = null;
  let start = 0;
  while (i < line.length) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i += 2;
      else {
        if (c === quote) {
          quote = null;
          start = i + 1;
        }
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      if (i > start) spans.push([start, i]);
      quote = c;
      i++;
      continue;
    }
    if ((lang === 'cpp' && c === '/' && line[i + 1] === '/') || (lang === 'python' && c === '#')) {
      if (i > start) spans.push([start, i]);
      return spans;
    }
    i++;
  }
  if (!quote && i > start) spans.push([start, line.length]);
  return spans;
}

function lineCandidates(line, lang) {
  const out = [];
  const trimmed = line.trim();
  if (!trimmed) return out;
  if (lang === 'cpp' && (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*'))) return out;
  if (lang === 'python' && (trimmed.startsWith('#') || trimmed.startsWith('import ') || trimmed.startsWith('from '))) return out;

  for (const [s, e] of codeSpans(line, lang)) {
    const seg = line.slice(s, e);
    // operators
    for (let i = 0; i < seg.length; i++) {
      const rest2 = seg.slice(i, i + 2);
      const rest3 = seg.slice(i, i + 3);
      const prev = seg[i - 1];
      const spaced = (len) => (i === 0 || prev === ' ') && (seg[i + len] === ' ');
      if (lang === 'cpp' && CPP_TWO.includes(rest2) && rest3 !== '<<=' && rest3 !== '>>=' && rest3 !== '<=>') {
        out.push({ index: s + i, len: 2, original: rest2 });
        i += 1;
        continue;
      }
      if (lang === 'python' && ['<=', '>=', '==', '!='].includes(rest2)) {
        out.push({ index: s + i, len: 2, original: rest2 });
        i += 1;
        continue;
      }
      const c = seg[i];
      if (['<', '>', '+', '-', '*'].includes(c) && spaced(1)) {
        out.push({ index: s + i, len: 1, original: c });
      }
    }
    if (lang === 'python') {
      for (const m of seg.matchAll(/\b(and|or)\b/g)) out.push({ index: s + m.index, len: m[1].length, original: m[1] });
    }
    // integer constants
    for (const m of seg.matchAll(/(?<![\w.])(\d+)(?![\w.])/g)) {
      out.push({ index: s + m.index, len: m[1].length, original: m[1], constant: true });
    }
  }
  return out;
}

/**
 * Generate up to `max` mutants of `source` (lang: 'cpp' | 'python').
 * Operators: relational (ROR), arithmetic (AOR), logical (LOR), constants (CONST).
 * Deterministic for a given seed. Returns [{ id, operator, line, original, replacement, source }].
 */
export function generateMutants(source, lang, { max = 30, seed = 1 } = {}) {
  const lines = source.split('\n');
  const all = [];
  lines.forEach((line, li) => {
    for (const cand of lineCandidates(line, lang)) {
      if (cand.constant) {
        const v = Number(cand.original);
        const reps = [String(v + 1)];
        if (v >= 1) reps.push(String(v - 1));
        for (const r of reps) all.push({ li, ...cand, replacement: r, operator: 'CONST' });
      } else {
        const rep = REPLACE[cand.original];
        if (rep) all.push({ li, ...cand, replacement: rep[0], operator: rep[1] });
      }
    }
  });

  const rng = mulberry32(seed);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  const seen = new Set();
  const mutants = [];
  for (const m of all) {
    if (mutants.length >= max) break;
    const line = lines[m.li];
    const mutatedLine = line.slice(0, m.index) + m.replacement + line.slice(m.index + m.len);
    const copy = [...lines];
    copy[m.li] = mutatedLine;
    const src = copy.join('\n');
    if (seen.has(src)) continue;
    seen.add(src);
    mutants.push({
      id: `m${mutants.length + 1}`,
      operator: m.operator,
      line: m.li + 1,
      original: m.original,
      replacement: m.replacement,
      snippet: mutatedLine.trim().slice(0, 120),
      source: src,
    });
  }
  return mutants;
}
