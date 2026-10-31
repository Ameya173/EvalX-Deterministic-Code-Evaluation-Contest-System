const tokens = (s) => s.split(/\s+/).filter(Boolean);

export function compareOutput(actual, expected, { type = 'token', epsilon = 1e-6 } = {}) {
  if (type === 'exact') {
    const norm = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
    return norm(actual) === norm(expected);
  }
  const a = tokens(actual);
  const b = tokens(expected);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (type === 'float') {
      const x = Number(a[i]);
      const y = Number(b[i]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const diff = Math.abs(x - y);
        if (diff <= epsilon || diff <= epsilon * Math.abs(y)) continue;
      }
    }
    return false;
  }
  return true;
}
