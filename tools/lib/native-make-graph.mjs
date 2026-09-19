// Consume the upstream-generated .packagedeps with GNU Make, without loading
// the build Makefile, invoking a recipe, or normalizing the user's .config.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const words = (value) => [...new Set(String(value || '').trim().split(/\s+/).filter(Boolean))];
const pathPattern = /^[A-Za-z0-9_+@./-]+$/;
const checkedPath = (value) => {
  if (!pathPattern.test(value) || value.split('/').includes('..')) throw new Error(`Invalid native source path: ${value}`);
  return value;
};
const sourcePath = (makefile) => checkedPath(makefile.replace(/^package\//, '').replace(/\/Makefile$/, ''));

function checkedAssignments(source) {
  // This is a syntax/safety boundary, not a Make expression interpreter. Only
  // assignment records emitted by package-metadata.pl are admitted. Unknown
  // native formats are reported, never executed or silently approximated.
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^(?:package-\$\(CONFIG_[A-Za-z0-9_+@./-]+\)|package-|prereq-(?:\$\(CONFIG_[A-Za-z0-9_+@./-]+\))?|buildtypes-[A-Za-z0-9_+@./-]+|\$\(curdir\)\/[A-Za-z0-9_+@./-]+)\s*(?:\+=|:=|=)\s*[^\r\n]*$/.test(line)) {
      throw new Error(`Unsupported native Make assignment: ${line.slice(0, 180)}`);
    }
    for (const match of line.matchAll(/\$\(([^\s(),]+)([\s),])/g)) {
      if (!['curdir', 'if', 'and', 'or'].includes(match[1]) && !/^CONFIG_[A-Za-z0-9_+@./-]+$/.test(match[1])) {
        throw new Error(`Unsupported native Make reference: ${match[1]}`);
      }
    }
    if (/[;\\\r\0#]/.test(line) || /\$(?!\()/.test(line)) throw new Error('Unsupported native Make syntax');
  }
  return source;
}

export function evaluateNativeMakeGraph({ graph, configValues, packageDepsPath, configPath, make = process.env.WEIG_MAKE || 'make' }) {
  const bytes = readFileSync(packageDepsPath);
  const assignments = checkedAssignments(bytes.toString('utf8'));
  if (!assignments.trim()) throw new Error('Native .packagedeps is empty');
  const nodes = new Map(), packageSources = new Map();
  for (const record of graph.packages.values()) {
    const owners = [...record.sourceMakefiles].map(sourcePath);
    if (owners.length !== 1) throw new Error(`Native package source identity is ambiguous: ${record.name}`);
    const owner = owners[0];
    packageSources.set(record.name, owner);
    for (const type of ['', ...words(record.buildFields?.['Build-Types'])]) {
      if (type) checkedPath(type);
      const key = `package/${owner}${type ? `/${type}` : ''}/compile`;
      if (!nodes.has(key)) nodes.set(key, { key, owner, type, edges: [], variants: [] });
    }
  }
  const input = ['curdir := package'];
  for (const [symbol, raw] of configValues) {
    if (!/^[A-Za-z0-9_+@./-]+$/.test(symbol) || /[\r\n\0]/.test(String(raw))) throw new Error('Invalid native configuration assignment');
    // An unset Kconfig bool has no Make variable. Escape data so user scalar
    // values can never introduce functions, includes, comments, or recipes.
    const value = raw === 'n' ? '' : String(raw).replaceAll('$', () => '$$').replaceAll('#', '\\#');
    if (value.endsWith('\\')) throw new Error(`Unsafe Make value continuation: ${symbol}`);
    input.push(`CONFIG_${symbol} := ${value}`);
  }
  input.push(assignments);
  input.push('$(info WEIG_ROOTS|$(sort $(package-y) $(package-m)))');
  for (const node of nodes.values()) {
    const owner = `package/${node.owner}`;
    input.push(`$(info WEIG_NODE|${node.key}|$(sort $(${node.key}))|$(sort $(filter-out *,$(if $(strip $(${owner}/variants)),$(${owner}/variants),$(${owner}/default-variant)))))`);
  }
  input.push('.PHONY: __weig_graph_only', '__weig_graph_only: ;', '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(?:CONFIG_|MAKE|GNUMAKEFLAGS$|MFLAGS$)/i.test(name)));
  const execution = spawnSync(make, ['--no-print-directory', '-s', '-rR', '-f', '-', '__weig_graph_only'], {
    input: input.join('\n'), encoding: 'utf8', env, timeout: 30000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (execution.error || execution.status !== 0 || execution.stderr.trim()) {
    throw new Error(`Native Make graph evaluation failed: ${execution.error?.message || execution.stderr || execution.status}`);
  }
  let roots;
  const received = new Set();
  for (const line of execution.stdout.split(/\r?\n/).filter(Boolean)) {
    if (line.startsWith('WEIG_ROOTS|')) {
      if (roots) throw new Error('Duplicate native root projection');
      roots = words(line.slice(11)).map((path) => `package/${checkedPath(path)}/compile`);
    } else if (line.startsWith('WEIG_NODE|')) {
      const [, key, edges, variants, extra] = line.split('|');
      const node = nodes.get(key);
      if (!node || received.has(key) || extra !== undefined) throw new Error('Invalid native node projection');
      received.add(key);
      node.edges = words(edges);
      node.variants = words(variants);
    } else if (!/^make(?:\[\d+\])?: Nothing to be done for /.test(line) && !/^mingw32-make(?:\[\d+\])?: Nothing to be done for /.test(line)) {
      throw new Error(`Unexpected native graph output: ${line.slice(0, 160)}`);
    }
  }
  if (!roots || received.size !== nodes.size) throw new Error('Incomplete native Make graph projection');
  const proof = { schema: 1, authority: 'upstream-.packagedeps/gnu-make',
    packageInfoSha256: graph.metadata.sha256, packageDepsSha256: hash(bytes),
    configSha256: hash(readFileSync(configPath)), roots, nodes: [...nodes.values()] };
  return { nodes, roots, packageSources, proof };
}

export function inspectNativeClosure(graph, active, targets) {
  const native = graph.native;
  const unresolved = [];
  if (!native) return { unresolved: [{ reason: 'native-make-graph-missing' }], checks: [] };
  const rootSet = new Set(native.roots);
  for (const name of active.keys()) {
    const source = native.packageSources.get(name);
    if (!source || !rootSet.has(`package/${source}/compile`)) {
      unresolved.push({ path: [name], reason: 'native-active-root-projection-missing' });
    }
  }
  const visited = new Set(), queue = native.roots.map((key) => [key, [key]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [key, path] = queue[cursor];
    if (visited.has(key)) continue;
    visited.add(key);
    const node = native.nodes.get(key);
    if (!node) { unresolved.push({ path, reason: 'native-compile-target-metadata-missing' }); continue; }
    for (const edge of node.edges) queue.push([edge, [...path, edge]]);
  }
  const checks = targets.map((target) => {
    const record = graph.packages.get(target);
    const owner = native.packageSources.get(target);
    const targetKey = `package/${owner}/compile`;
    const targetNode = native.nodes.get(targetKey);
    const compiledVariant = !record?.variant || targetNode?.variants.includes(record.variant);
    const paths = [];
    if (compiledVariant) {
      for (const root of native.roots) {
        // One proof path per root is sufficient; cycles/shared subgraphs must
        // not enumerate exponentially many equivalent paths.
        const pending = [[root, [root]]], seen = new Set();
        for (let cursor = 0; cursor < pending.length; cursor++) {
          const [key, path] = pending[cursor];
          if (seen.has(key)) continue;
          seen.add(key);
          if (key === targetKey) { paths.push([...path, target]); break; }
          for (const edge of native.nodes.get(key)?.edges || []) pending.push([edge, [...path, edge]]);
        }
      }
    }
    return { target, status: paths.length ? 'reachable' : unresolved.length ? 'inconclusive' : 'not-reachable',
      candidates: paths.map((path) => path[0]), paths, unresolved };
  });
  return { unresolved, checks };
}
