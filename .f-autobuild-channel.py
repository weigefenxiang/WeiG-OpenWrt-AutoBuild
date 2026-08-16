from pathlib import Path

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

# One runtime authority: canonical fix-* maps to the same catalog-fix-* suffix.
path = 'site/wrt/lib/build-identity.js'
text = read(path)
old = '''const CATALOG_DATA_BRANCHES = Object.freeze({\n  fix: 'catalog-fix',\n  'fix-A': 'catalog-fix-A',\n  'fix-B': 'catalog-fix-B',\n  'fix-C': 'catalog-fix-C',\n  dev: 'catalog-dev',\n  staging: 'catalog-staging',\n  main: 'catalog-data',\n});\n\nfunction catalogFixChannel(environment) {\n  const lane = /-([ABC])$/i.exec(String(environment || ''))?.[1]?.toUpperCase() || '';\n  return lane ? `fix-${lane}` : 'fix';\n}\n'''
new = '''const CATALOG_DATA_BRANCHES = Object.freeze({\n  fixPrefix: 'catalog-fix-',\n  legacyFix: 'catalog-fix',\n  dev: 'catalog-dev',\n  staging: 'catalog-staging',\n  main: 'catalog-main',\n});\nconst CANONICAL_FIX_RE = /^fix-([A-Za-z0-9][A-Za-z0-9._-]{0,95})$/;\n\nfunction configuredCatalogChannel(configured, key) {\n  const mapping = configured && typeof configured === 'object' ? configured : {};\n  const expected = CATALOG_DATA_BRANCHES[key];\n  const branch = String(mapping[key] || expected || '').trim();\n  if (!expected || branch !== expected) throw new Error(`invalid Catalog data branch for ${key}`);\n  return branch;\n}\n\n// Frozen compatibility only for historical slash-style fix branches.\nfunction legacyFixDataBranch(environment) {\n  const ref = String(environment || '');\n  if (!/^fix\\/[A-Za-z0-9._/-]+$/.test(ref)) return '';\n  const lane = /-([ABC])$/i.exec(ref)?.[1]?.toUpperCase() || '';\n  return lane ? `catalog-fix-${lane}` : 'catalog-fix';\n}\n'''
text = replace_once(text, old, new, 'build identity mapping block')
old = '''export function catalogDataBranch(value, configured = CATALOG_DATA_BRANCHES) {\n  const environment = normalizeBuildEnvironment(value) || 'main';\n  const channel = environment.startsWith('fix/') ? catalogFixChannel(environment)\n    : ['dev', 'staging', 'main'].includes(environment) ? environment : 'main';\n  const mapping = configured && typeof configured === 'object' ? configured : {};\n  const branch = String(mapping[channel] || CATALOG_DATA_BRANCHES[channel] || '').trim();\n  if (branch !== CATALOG_DATA_BRANCHES[channel]) {\n    throw new Error(`invalid Catalog data branch for ${channel}`);\n  }\n  return branch;\n}\n'''
new = '''export function catalogDataBranch(value, configured = CATALOG_DATA_BRANCHES) {\n  const environment = normalizeBuildEnvironment(value) || 'main';\n  const canonicalFix = CANONICAL_FIX_RE.exec(environment)?.[1] || '';\n  if (canonicalFix) {\n    return `${configuredCatalogChannel(configured, 'fixPrefix')}${canonicalFix}`;\n  }\n  const legacyFix = legacyFixDataBranch(environment);\n  if (legacyFix) {\n    if (legacyFix === 'catalog-fix') configuredCatalogChannel(configured, 'legacyFix');\n    return legacyFix;\n  }\n  const channel = ['dev', 'staging', 'main'].includes(environment) ? environment : 'main';\n  return configuredCatalogChannel(configured, channel);\n}\n'''
text = replace_once(text, old, new, 'catalogDataBranch')
write(path, text)

# Loader accepts canonical catalog-fix-* generically and production is catalog-main.
path = 'site/wrt/lib/catalog-loader.js'
text = read(path)
old = '''export function safeCatalogDataRef(value) {\n  const ref = String(value || '').trim();\n  if (!/^catalog-(?:fix(?:-[ABC])?|dev|staging|data)$/.test(ref)) {\n    throw new Error(`invalid Catalog data branch: ${value}`);\n  }\n  return ref;\n}\n\nfunction catalogFixCodeRefMatches(codeRef, branch) {\n  if (!/^fix\\/[A-Za-z0-9._/-]+$/.test(codeRef)) return false;\n  const lane = /-([ABC])$/i.exec(codeRef)?.[1]?.toUpperCase() || '';\n  if (branch === 'catalog-fix') return lane === '';\n  return Boolean(lane) && branch === `catalog-fix-${lane}`;\n}\n'''
new = '''export function safeCatalogDataRef(value) {\n  const ref = String(value || '').trim();\n  if (!/^catalog-(?:fix(?:-[A-Za-z0-9][A-Za-z0-9._-]{0,95})?|dev|staging|main)$/.test(ref)) {\n    throw new Error(`invalid Catalog data branch: ${value}`);\n  }\n  return ref;\n}\n\nfunction catalogFixCodeRefMatches(codeRef, branch) {\n  const ref = String(codeRef || '').trim();\n  if (branch === 'catalog-fix') {\n    if (!/^fix\\/[A-Za-z0-9._/-]+$/.test(ref)) return false;\n    return !/-[ABC]$/i.test(ref);\n  }\n  const suffix = /^catalog-fix-([A-Za-z0-9][A-Za-z0-9._-]{0,95})$/.exec(branch)?.[1] || '';\n  if (!suffix) return false;\n  if (ref === `fix-${suffix}`) return true;\n  if (!/^fix\\/[A-Za-z0-9._/-]+$/.test(ref)) return false;\n  const legacyLane = /-([ABC])$/i.exec(ref)?.[1]?.toUpperCase() || '';\n  return Boolean(legacyLane) && suffix === legacyLane;\n}\n'''
text = replace_once(text, old, new, 'loader data ref block')
if text.count("'catalog-data'") < 3:
    raise SystemExit(f'loader expected at least 3 catalog-data literals, got {text.count("\'catalog-data\'")}')
text = text.replace("'catalog-data'", "'catalog-main'")
write(path, text)

# Project config is a validated presentation of the same central mapping, with no A/B/C/E cases.
path = 'site/wrt/data/project.json'
text = read(path)
old = '''  "catalogDataBranches": {\n    "fix": "catalog-fix",\n    "dev": "catalog-dev",\n    "staging": "catalog-staging",\n    "main": "catalog-data"\n  }\n'''
new = '''  "catalogDataBranches": {\n    "fixPrefix": "catalog-fix-",\n    "legacyFix": "catalog-fix",\n    "dev": "catalog-dev",\n    "staging": "catalog-staging",\n    "main": "catalog-main"\n  }\n'''
text = replace_once(text, old, new, 'project catalog branches')
write(path, text)

# Build identity regression: canonical F and arbitrary suffix are standard; slash branches remain compatibility only.
path = 'tools/test-build-identity.mjs'
text = read(path)
old = '''const catalogChannels = {\n  fix: 'catalog-fix',\n  'fix-A': 'catalog-fix-A',\n  'fix-B': 'catalog-fix-B',\n  'fix-C': 'catalog-fix-C',\n  dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-data',\n};\nassert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-fix');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-A', catalogChannels), 'catalog-fix-A');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-B', catalogChannels), 'catalog-fix-B');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-C', catalogChannels), 'catalog-fix-C');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-a', catalogChannels), 'catalog-fix-A');\nassert.throws(() => catalogDataBranch('fix/demo-A', { ...catalogChannels, 'fix-A': 'catalog-fix-B' }),\n  /invalid Catalog data branch/);\nassert.equal(catalogDataBranch('dev', catalogChannels), 'catalog-dev');\nassert.equal(catalogDataBranch('staging', catalogChannels), 'catalog-staging');\nassert.equal(catalogDataBranch('main', catalogChannels), 'catalog-data');\nassert.equal(catalogDataBranch('', catalogChannels), 'catalog-data');\nassert.equal(catalogDataBranch('feature/unpublished', catalogChannels), 'catalog-data');\nassert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-data' }),\n  /invalid Catalog data branch/);\n'''
new = '''const catalogChannels = {\n  fixPrefix: 'catalog-fix-', legacyFix: 'catalog-fix',\n  dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-main',\n};\nassert.equal(catalogDataBranch('fix-F', catalogChannels), 'catalog-fix-F');\nassert.equal(catalogDataBranch('fix-next.test', catalogChannels), 'catalog-fix-next.test');\nassert.equal(catalogDataBranch('fix-a', catalogChannels), 'catalog-fix-a');\nassert.throws(() => catalogDataBranch('fix-F', { ...catalogChannels, fixPrefix: 'catalog-other-' }),\n  /invalid Catalog data branch/);\n// Historical slash-style branches remain read-compatible but are not the standard authority.\nassert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-fix');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-A', catalogChannels), 'catalog-fix-A');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-B', catalogChannels), 'catalog-fix-B');\nassert.equal(catalogDataBranch('fix/catalog-compatibility-C', catalogChannels), 'catalog-fix-C');\nassert.equal(catalogDataBranch('dev', catalogChannels), 'catalog-dev');\nassert.equal(catalogDataBranch('staging', catalogChannels), 'catalog-staging');\nassert.equal(catalogDataBranch('main', catalogChannels), 'catalog-main');\nassert.equal(catalogDataBranch('', catalogChannels), 'catalog-main');\nassert.equal(catalogDataBranch('feature/unpublished', catalogChannels), 'catalog-main');\nassert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-main' }),\n  /invalid Catalog data branch/);\n'''
text = replace_once(text, old, new, 'build identity channel tests')
old = '''assert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-A', 'owner/catalog')?.codeRef,\n  'fix/demo-A');\nassert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-b'), 'catalog-fix-B', 'owner/catalog')?.codeRef,\n  'fix/demo-b');\nassert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-C'), 'catalog-fix-C', 'owner/catalog')?.codeRef,\n  'fix/demo-C');\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-B', 'owner/catalog'),\n  /does not match catalog-fix-B/);\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix', 'owner/catalog'),\n  /does not match catalog-fix/);\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo'), 'catalog-fix-A', 'owner/catalog'),\n  /does not match catalog-fix-A/);\n'''
new = '''assert.equal(validateCatalogProvenance(catalogProvenance('fix-F'), 'catalog-fix-F', 'owner/catalog')?.codeRef,\n  'fix-F');\nassert.equal(validateCatalogProvenance(catalogProvenance('fix-next.test'), 'catalog-fix-next.test', 'owner/catalog')?.codeRef,\n  'fix-next.test');\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix-F'), 'catalog-fix-G', 'owner/catalog'),\n  /does not match catalog-fix-G/);\n// Historical slash-style A/B/C provenance remains compatible.\nassert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-A', 'owner/catalog')?.codeRef,\n  'fix/demo-A');\nassert.equal(validateCatalogProvenance(catalogProvenance('fix/demo-b'), 'catalog-fix-B', 'owner/catalog')?.codeRef,\n  'fix/demo-b');\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix-B', 'owner/catalog'),\n  /does not match catalog-fix-B/);\nassert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix', 'owner/catalog'),\n  /does not match catalog-fix/);\n'''
text = replace_once(text, old, new, 'build identity provenance tests')
write(path, text)

# Loader regression: main runtime is catalog-main and canonical fix provenance is exact-suffix.
path = 'tools/test-catalog-loader.mjs'
text = read(path)
text = text.replace("'catalog-data'", "'catalog-main'")
anchor = '''assert(validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix/demo' } },\n  'catalog-fix', 'owner/catalog')?.codeRef === 'fix/demo', 'catalog-fix provenance did not validate');\n'''
insert = anchor + '''assert(validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix-F' } },\n  'catalog-fix-F', 'owner/catalog')?.codeRef === 'fix-F', 'canonical catalog-fix-F provenance did not validate');\nassertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix-G' } },\n  'catalog-fix-F', 'owner/catalog'), /does not match catalog-fix-F/);\n'''
text = replace_once(text, anchor, insert, 'loader canonical fix tests')
write(path, text)

# Print any remaining active old production-name references for the validation log.
for root in [Path('site/wrt'), Path('tools')]:
    for file in root.rglob('*'):
        if not file.is_file() or file.suffix not in {'.js', '.mjs', '.json', '.html', '.css'}:
            continue
        body = file.read_text(encoding='utf-8', errors='ignore')
        if 'catalog-data' in body:
            print(f'REMAINING catalog-data: {file}')

print('AutoBuild F Catalog channel patch applied')
