let rows = [];
let gramIndex = new Map();

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function gramsFor(value) {
  const grams = new Set();
  for (const token of normalized(value).split(/\s+/).filter(Boolean)) {
    if (token.length < 2) continue;
    for (let index = 0; index < token.length - 1; index++) grams.add(token.slice(index, index + 2));
  }
  return grams;
}

function buildIndex(input) {
  rows = (input || []).map(([symbol, text]) => [String(symbol || ''), normalized(text)]);
  gramIndex = new Map();
  rows.forEach(([, text], rowId) => {
    for (const gram of gramsFor(text)) {
      if (!gramIndex.has(gram)) gramIndex.set(gram, []);
      gramIndex.get(gram).push(rowId);
    }
  });
}

function intersectSorted(left, right) {
  const output = [];
  let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      output.push(left[a]);
      a++;
      b++;
    } else if (left[a] < right[b]) a++;
    else b++;
  }
  return output;
}

function search(query) {
  const text = normalized(query);
  if (text.length < 2) return [];
  const grams = [...gramsFor(text)];
  if (!grams.length) return rows.filter(([, hay]) => hay.includes(text)).map(([symbol]) => symbol);
  const buckets = grams.map((gram) => gramIndex.get(gram) || []).sort((a, b) => a.length - b.length);
  if (!buckets[0]?.length) return [];
  let candidates = buckets[0];
  for (let index = 1; index < buckets.length && candidates.length; index++) {
    candidates = intersectSorted(candidates, buckets[index]);
  }
  return candidates.filter((rowId) => rows[rowId]?.[1].includes(text)).map((rowId) => rows[rowId][0]);
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') {
    buildIndex(message.rows);
    self.postMessage({ type: 'ready', generation: message.generation, rows: rows.length });
    return;
  }
  if (message.type === 'query') {
    self.postMessage({
      type: 'result',
      generation: message.generation,
      requestId: message.requestId,
      query: normalized(message.query),
      symbols: search(message.query),
    });
  }
};
