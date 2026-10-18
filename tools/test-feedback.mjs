import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FEEDBACK_FIELDS, feedbackEnvironment, feedbackReport, feedbackIssueForm,
  feedbackIssueLink, feedbackLanguage, feedbackInterface, createFeedbackTemplateResolver } from '../site/wrt/lib/feedback.js';
import { githubIssueUrl, isValidGithubOwner, ISSUE_URL_LIMIT } from '../site/wrt/lib/build-identity.js';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const english = JSON.parse(read('site/wrt/data/i18n/en.json')).strings;
const chinese = JSON.parse(read('site/wrt/data/i18n/zh-CN.json')).strings;
const identity = { githubIssueUrl, ISSUE_URL_LIMIT };
const environment = feedbackEnvironment({ source: 'source', branch: 'branch',
  target: { system: 'system', subtarget: 'subtarget', profile: 'profile', rootpw: 'hidden' },
  version: 'version', commit: 'commit', width: 390, height: 844, userAgent: 'Browser/155',
  rootpw: 'Test1234', lanip: '192.168.1.1', config: 'private', owner: 'owner', token: 'token' });
assert.equal(environment['Target Profile'], 'profile');
assert.equal(environment.Browser, 'Browser/155');
assert.equal(feedbackEnvironment({ width: 1648.8889, height: 1231.1111 }).Viewport, '1649 × 1231');
assert.doesNotMatch(JSON.stringify(environment), /hidden|Test1234|192\.168|private|owner|token/);
for (const strings of [english, chinese]) {
  const report = feedbackReport({ category: 'build', interface: 'mobile', description: 'problem' }, environment, key => strings[key]);
  assert(report.includes(strings['feedback.category.build']));
  assert(report.includes('Browser/155')); assert(!report.includes('undefined'));
  const issue = new URL(githubIssueUrl('owner/repo', { title: '[feedback] problem', body: report }));
  assert.equal(issue.searchParams.get('body'), report);
  assert(!issue.searchParams.get('title').startsWith('[build]'));
  for (const nativeTemplate of [true, false]) {
    const link = feedbackIssueLink({ repository: 'owner/repo', environment, language: strings === chinese ? 'zh-CN' : 'en',
      interfaceType: 'mobile', nativeTemplate, translate: key => strings[key], identity });
    const url = new URL(link.url);
    assert(!link.overflow); assert(!link.report.includes('undefined'));
    assert(!url.searchParams.has('description'));
    if (nativeTemplate) {
      assert.equal(JSON.parse(url.searchParams.get('environment'))['Target Profile'], 'profile');
      assert.equal(url.searchParams.get('interface'), strings['feedback.interface.mobile']);
      assert(url.searchParams.get('template').startsWith('feedback.'));
    } else {
      assert.equal(url.searchParams.get('body'), link.report);
      assert(link.report.includes(strings['feedback.description.hint']));
    }
  }
}
assert.equal(feedbackLanguage('zh-CN'), 'zh-CN');
for (const lang of ['de', 'zh-TW', 'ar', 'unknown']) assert.equal(feedbackLanguage(lang), 'en');
assert.equal(feedbackInterface('Mozilla Android Mobile'), 'mobile');
assert.equal(feedbackInterface('Mozilla iPhone'), 'mobile');
assert.equal(feedbackInterface('Mozilla Android'), 'tablet');
assert.equal(feedbackInterface('Mozilla Mac', 'MacIntel', 5), 'tablet');
assert.equal(feedbackInterface('Mozilla Windows'), 'desktop');
let requests = 0;
const resolveTemplate = createFeedbackTemplateResolver({ issueUrl: githubIssueUrl, fetchImpl: async (url, options) => {
  requests++; assert.equal(options.credentials, 'omit'); assert(options.signal);
  assert(!url.includes('?ref='));
  return { ok: true, json: async () => ({ type: 'file', name: url.split('/').at(-1) }) };
} });
assert(await resolveTemplate('owner/repo', 'en')); assert(await resolveTemplate('owner/repo', 'ar'));
assert.equal(requests, 1, 'template availability is cached by effective form language');
for (const fetchImpl of [async () => ({ ok: false }), async () => { throw Error('offline'); },
  async () => ({ ok: true, json: async () => ({ type: 'dir' }) })]) {
  assert.equal(await createFeedbackTemplateResolver({ issueUrl: githubIssueUrl, fetchImpl })('owner/repo', 'en'), false);
}
const long = feedbackIssueLink({ repository: 'owner/repo', environment: { Browser: 'x'.repeat(8000) },
  interfaceType: 'desktop', language: 'en', translate: key => english[key], identity });
assert(long.overflow); assert(long.report.includes('x'.repeat(8000))); assert(long.url.length <= ISSUE_URL_LIMIT);
assert.doesNotMatch(read('site/wrt/lib/diagnostics/feedback-controller.js'), /openModal|feedbackForm|localStorage|fetch\([^]*method:\s*['"]POST/);
assert.doesNotMatch(read('site/wrt/styles/40-overlays.css'), /feedback-dialog|feedback-form/);
for (const lang of JSON.parse(read('site/wrt/data/i18n/index.json')).languages.filter(row => !row.pending)) {
  const strings = JSON.parse(read(`site/wrt/data/i18n/${lang.id}.json`)).strings;
  assert.doesNotMatch(strings['tag.label'], /[()（）]|Actions/);
  assert(strings['submit.m1.desc'].includes('*.json'));
}
assert.equal(ISSUE_URL_LIMIT, 6000);
for (const owner of ['', '-name', 'name-', 'name--name', 'https://github.com/name', 'a'.repeat(40)]) assert(!isValidGithubOwner(owner));
for (const owner of ['a', 'levenwindy', 'name-name', 'a'.repeat(39)]) assert(isValidGithubOwner(owner));
assert.throws(() => githubIssueUrl('owner/repo/../../other', {}));
for (const lang of ['en', 'zh-CN']) {
  const strings = lang === 'en' ? english : chinese;
  const generated = read(`.github/ISSUE_TEMPLATE/feedback.${lang}.yml`);
  assert.equal(generated, feedbackIssueForm(key => strings[key]));
  for (const field of FEEDBACK_FIELDS) assert(generated.includes(`id: ${field.id}\n`));
  assert(!generated.includes('custom-build')); assert(!generated.includes('[build]'));
}
// Existence comes only from the active branch. Root names cannot invent apps.
const source = read('site/wrt/lib/catalog/catalog-controller.js');
const fn = source.match(/function catalogApplicationsPluginData\([^]*?\n\}/)[0];
const context = {};
vm.createContext(context); vm.runInContext(fn, context);
const names = { groups: ['Other'], items: [{ package: 'luci-app-a', titleEn: 'App A' }, { package: 'luci-app-b' }] };
assert.equal(context.catalogApplicationsPluginData(names, null).plugins.length, 0);
const branch = name => ({ applications: { kind: 'branch-applications', encoding: 'positional-rows-v1',
  fields: ['symbol', 'package', 'group', 'hot'], rows: [[`PACKAGE_luci-app-${name}`, `luci-app-${name}`, 'Other', 0]] } });
assert.deepEqual([...context.catalogApplicationsPluginData(names, branch('a')).plugins].map(p => p.pkg), ['luci-app-a']);
assert.deepEqual([...context.catalogApplicationsPluginData(names, branch('b')).plugins].map(p => p.pkg), ['luci-app-b']);
assert.equal(context.catalogApplicationsPluginData(names, branch('a')).plugins[0].name, 'App A');
// A failed/currently loading branch cannot expose the previous branch's cards
// or leave a perpetual spinner while the root naming dictionary is ready.
const renderer = read('site/wrt/lib/plugins/plugin-controller.js').match(/function renderCatalogApplicationsState\([^]*?\n\}/)[0];
const node = tag => ({ tag, children: [], dataset: {}, appendChild(child) { this.children.push(child); },
  setAttribute() {}, addEventListener(type, fn) { this[type] = fn; } });
let retried = '';
Object.assign(context, { PLUGINS: { plugins: [{ id: 'old-source-app' }] }, MENU_CATALOG: null,
  catalogLoadMode: 'error', catalogLoadError: 'branch failed', catalogApplicationsLoadState: 'ready',
  catalogApplicationsError: '', document: { createElement: node }, displayText: value => value,
  t: (key, values) => values?.value1 || key, bindUiTooltipContent() {},
  retryCatalogLoad: () => { retried = 'branch'; }, requestCatalogApplications: () => { retried = 'names'; } });
vm.runInContext(renderer, context);
let box = node('div');
assert(context.renderCatalogApplicationsState(box));
assert.equal(box.children[0].dataset.state, 'error');
assert(!box.children[0].children.some(child => child.className === 'catalog-applications-spinner'));
box.children[0].click(); assert.equal(retried, 'branch');
context.catalogLoadMode = 'loading'; box = node('div');
assert(context.renderCatalogApplicationsState(box)); assert.equal(box.children[0].dataset.state, 'loading');
console.log('Feedback, native templates, environment privacy and per-branch applications passed.');
