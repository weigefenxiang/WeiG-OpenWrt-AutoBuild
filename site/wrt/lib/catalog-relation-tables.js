// Consumer for the versioned Catalog relation tables; producer parity is
// checked by test-catalog-producer-contract.mjs.
export function decodeRelationTables(document) {
  if (document?.schema !== 5 || document.encoding !== 'interned-relations-v1' ||
      !Array.isArray(document.shapes) || !Array.isArray(document.nodes)) {
    throw new Error('Unsupported interned relations document');
  }
  const { shapes, nodes } = document;
  const values = [];
  for (const keys of shapes) {
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string') ||
        new Set(keys).size !== keys.length) throw new Error('Invalid relation shape');
  }
  for (const row of nodes) {
    if (!Array.isArray(row) || !Number.isInteger(row[0])) throw new Error('Invalid relation node');
    if (row[0] === -1) {
      if (row.length !== 2 || (row[1] !== null && !['string', 'number', 'boolean'].includes(typeof row[1]))) {
        throw new Error('Invalid relation atom');
      }
      values.push(row[1]); continue;
    }
    const read = (id) => {
      if (!Number.isSafeInteger(id) || id < 0 || id >= values.length) throw new Error('Invalid relation reference');
      return values[id];
    };
    if (row[0] === -2) {
      const fields = new Array(row.length - 1);
      for (let index = 1; index < row.length; index++) fields[index - 1] = read(row[index]);
      values.push(fields);
    }
    else {
      const keys = shapes[row[0]];
      if (!keys || keys.length !== row.length - 1) {
        throw new Error('Invalid relation shape');
      }
      const value = {};
      for (let index = 0; index < keys.length; index++) {
        const field = read(row[index + 1]);
        if (keys[index] === '__proto__') Object.defineProperty(value, keys[index], { value: field, enumerable: true });
        else value[keys[index]] = field;
      }
      values.push(value);
    }
  }
  const decoded = values[document.root];
  if (!Number.isSafeInteger(document.root) || decoded?.schema !== 4) throw new Error('Invalid relation root');
  return decoded;
}

export function decodeCompactRelationTables(source) {
  if (source?.schema !== 5 || source.encoding !== 'interned-definitions-edge-rows-v1' ||
      !Array.isArray(source.edgeFields) || !Array.isArray(source.edges) ||
      source.edgeFields.some((field) => typeof field !== 'string' || field === '__proto__') ||
      new Set(source.edgeFields).size !== source.edgeFields.length) {
    throw new Error('Unsupported compact relation tables');
  }
  const { edgeFields, encoding, ...document } = source;
  return { ...document, schema: 4,
    definitions: decodeRelationTables(source.definitions).definitions,
    edges: source.edges.map((row) => {
      if (!Array.isArray(row) || row.length !== edgeFields.length) throw new Error('Invalid relation edge row');
      const edge = {};
      for (let index = 0; index < row.length; index++) edge[edgeFields[index]] = row[index];
      return edge;
    }) };
}
