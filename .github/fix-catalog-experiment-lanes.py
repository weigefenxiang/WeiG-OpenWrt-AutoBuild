from pathlib import Path


def replace_once(path, old, new):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


identity = Path('site/wrt/lib/build-identity.js')
replace_once(identity, """const CATALOG_DATA_BRANCHES = Object.freeze({
  fix: 'catalog-fix',
  dev: 'catalog-dev',
  staging: 'catalog-staging',
  main: 'catalog-data',
});
""", """const CATALOG_DATA_BRANCHES = Object.freeze({
  fix: 'catalog-fix',
  'fix-A': 'catalog-fix-A',
  'fix-B': 'catalog-fix-B',
  'fix-C': 'catalog-fix-C',
  dev: 'catalog-dev',
  staging: 'catalog-staging',
  main: 'catalog-data',
});

function catalogFixChannel(environment) {
  const lane = /-([ABC])$/i.exec(String(environment || ''))?.[1]?.toUpperCase() || '';
  return lane ? `fix-${lane}` : 'fix';
}
""")
replace_once(identity,
    "const channel = environment.startsWith('fix/') ? 'fix'\n    : ['dev', 'staging', 'main'].includes(environment) ? environment : 'main';",
    "const channel = environment.startsWith('fix/') ? catalogFixChannel(environment)\n    : ['dev', 'staging', 'main'].includes(environment) ? environment : 'main';")

loader = Path('site/wrt/lib/catalog-loader.js')
replace_once(loader,
    "if (!/^catalog-(?:fix|dev|staging|data)$/.test(ref)) {",
    "if (!/^catalog-(?:fix(?:-[ABC])?|dev|staging|data)$/.test(ref)) {")
replace_once(loader, """export function validateCatalogProvenance(index, dataRef, repository) {
""", """function catalogFixCodeRefMatches(codeRef, branch) {
  if (!/^fix\\/[A-Za-z0-9._/-]+$/.test(codeRef)) return false;
  const lane = /-([ABC])$/i.exec(codeRef)?.[1]?.toUpperCase() || '';
  if (branch === 'catalog-fix') return lane === '';
  return Boolean(lane) && branch === `catalog-fix-${lane}`;
}

export function validateCatalogProvenance(index, dataRef, repository) {
""")
replace_once(loader, """const validCodeRef = branch === 'catalog-fix' ? /^fix\\/[A-Za-z0-9._/-]+$/.test(codeRef)
    : branch === 'catalog-dev' ? codeRef === 'dev'
      : branch === 'catalog-staging' ? codeRef === 'staging'
        : codeRef === 'main';
""", """const validCodeRef = branch.startsWith('catalog-fix') ? catalogFixCodeRefMatches(codeRef, branch)
    : branch === 'catalog-dev' ? codeRef === 'dev'
      : branch === 'catalog-staging' ? codeRef === 'staging'
        : codeRef === 'main';
""")

test = Path('tools/test-build-identity.mjs')
replace_once(test, """} from '../site/wrt/lib/build-identity.js';
""", """} from '../site/wrt/lib/build-identity.js';
import { validateCatalogProvenance } from '../site/wrt/lib/catalog-loader.js';
""")
replace_once(test, """const catalogChannels = {
  fix: 'catalog-fix', dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-data',
};
assert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-fix');
""", """const catalogChannels = {
  fix: 'catalog-fix',
  'fix-A': 'catalog-fix-A',
  'fix-B': 'catalog-fix-B',
  'fix-C': 'catalog-fix-C',
  dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-data',
};
assert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-fix');
assert.equal(catalogDataBranch('fix/catalog-compatibility-A', catalogChannels), 'catalog-fix-A');
assert.equal(catalogDataBranch('fix/catalog-compatibility-B', catalogChannels), 'catalog-fix-B');
assert.equal(catalogDataBranch('fix/catalog-compatibility-C', catalogChannels), 'catalog-fix-C');
assert.equal(catalogDataBranch('fix/catalog-compatibility-a', catalogChannels), 'catalog-fix-A');
assert.throws(() => catalogDataBranch('fix/demo-A', { ...catalogChannels, 'fix-A': 'catalog-fix-B' }),
  /invalid Catalog data branch/);
""")
replace_once(test, """assert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-data' }),
  /invalid Catalog data branch/);

assert.equal(normalizeBuildCommit""", """assert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-data' }),
  /invalid Catalog data branch/);

const catalogProvenanceSha = 'f'.repeat(40);
const catalogProvenance = (codeRef) => ({
  provenance: {
    repository: 'owner/catalog', codeRef, codeSha: catalogProvenanceSha, complete: true,
  },
});
assert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-A', 'owner/catalog')?.codeRef,
  'fix/demo-A');
assert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-b'), 'catalog-fix-B', 'owner/catalog')?.codeRef,
  'fix/demo-b');
assert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-C'), 'catalog-fix-C', 'owner/catalog')?.codeRef,
  'fix/demo-C');
assert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-B', 'owner/catalog'),
  /does not match catalog-fix-B/);
assert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix', 'owner/catalog'),
  /does not match catalog-fix/);
assert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo'), 'catalog-fix-A', 'owner/catalog'),
  /does not match catalog-fix-A/);

assert.equal(normalizeBuildCommit""")
