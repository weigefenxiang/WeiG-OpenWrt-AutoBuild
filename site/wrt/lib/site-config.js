/*
 * Pure public site configuration contract.
 *
 * This module deliberately has no Node, DOM, storage, or network dependency.
 * Node-side loaders add only the cross-authority checks for timezone and mirror
 * references; browser consumers can use the same syntax/shape validator.
 */
'use strict';

export const SITE_CONFIG_SCHEMA = 1;

const SITE_TOP_LEVEL_KEYS = ['project', 'catalog', 'ui', 'firmware', 'build'];
const PROJECT_KEYS = ['displayName', 'shortName', 'repository', 'blogUrl'];
const CATALOG_KEYS = ['repository', 'releaseTag', 'selection', 'loading'];
const SELECTION_KEYS = ['sourcePriority', 'defaultSource', 'developmentBranches', 'preferredTarget'];
const TARGET_KEYS = ['selectors'];
const SELECTOR_KEYS = ['system', 'subtarget', 'profile'];
const LOADING_KEYS = ['startup', 'idle', 'startupConcurrency', 'idleConcurrency', 'idleDelayMs'];
const UI_KEYS = ['defaultLanguage', 'colorMode'];
const FIRMWARE_KEYS = ['lanIp', 'timezone', 'theme', 'ntp', 'packageMirror'];
const TIMEZONE_KEYS = ['zonename', 'timezone'];
const NTP_KEYS = ['preset', 'servers'];
const BUILD_KEYS = ['defaultTag'];

const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/;
const SYMBOL_RE = /^[A-Za-z0-9_+@./-]{1,160}$/;
const TASK_RE = /^[a-z][A-Za-z0-9:-]{0,63}$/;
const SHORT_NAME_RE = /^[\p{L}\p{N}\p{M}][\p{L}\p{N}\p{M} ._+@()\-]*$/u;
const ZONENAME_RE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+$/;
const TIMEZONE_RE = /^[A-Za-z0-9._+<>,:/-]{1,128}$/;
const THEME_RE = /^luci-theme-[A-Za-z0-9._+-]{1,48}$/;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

const LANGUAGES = new Set(['auto', 'zh-CN', 'en']);
const COLOR_MODES = new Set(['auto', 'light', 'dark']);
const NTP_PRESETS = new Set(['cn', 'global', 'cloudflare']);
const CONTROL_CHARACTER_RE = /[\p{Cc}\p{Cf}\p{Cs}]/u;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pathName(path, key = '') {
  return key ? `${path}.${key}` : path;
}

function addUnknownAndMissing(value, path, keys, errors) {
  if (!isRecord(value)) return;
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${pathName(path, key)}: unknown key`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${pathName(path, key)}: required`);
  }
}

function stringError(value, path, errors, { min = 1, max = Infinity, pattern, trim = true } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${path}: must be a string`);
    return false;
  }
  const length = Array.from(value).length;
  if (length < min) errors.push(`${path}: must contain at least ${min} character${min === 1 ? '' : 's'}`);
  if (length > max) errors.push(`${path}: must contain at most ${max} characters`);
  if (trim && value !== value.trim()) errors.push(`${path}: must not have leading or trailing whitespace`);
  if (pattern && !pattern.test(value)) errors.push(`${path}: has an invalid format`);
  if (CONTROL_CHARACTER_RE.test(value)) errors.push(`${path}: control characters are not allowed`);
  return true;
}

function numberError(value, path, errors, min, max) {
  if (!Number.isInteger(value)) {
    errors.push(`${path}: must be an integer`);
    return;
  }
  if (value < min || value > max) errors.push(`${path}: must be between ${min} and ${max}`);
}

function enumError(value, path, errors, values) {
  if (typeof value !== 'string' || !values.has(value)) {
    errors.push(`${path}: must be one of ${[...values].join(', ')}`);
  }
}

function arrayError(value, path, errors, { min = 1, max = Infinity, item } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return;
  }
  if (value.length < min) errors.push(`${path}: must contain at least ${min} item${min === 1 ? '' : 's'}`);
  if (value.length > max) errors.push(`${path}: must contain at most ${max} items`);
  if (new Set(value).size !== value.length) errors.push(`${path}: duplicate items are not allowed`);
  if (item) value.forEach((entry, index) => item(entry, `${path}[${index}]`, errors));
}

function validateRepository(value, path, errors) {
  if (!stringError(value, path, errors, { pattern: REPOSITORY_RE }) ||
      typeof value !== 'string' || !REPOSITORY_RE.test(value)) return;
  const [owner, repository] = value.split('/');
  if (owner.length > 100 || repository.length > 100) errors.push(`${path}: owner and repository names are too long`);
}

function validateHttpsUrl(value, path, errors) {
  if (typeof value === 'string' && value === '') return;
  if (!stringError(value, path, errors, { min: 1 })) return;
  let parsed;
  try { parsed = new URL(value); } catch { errors.push(`${path}: must be a valid URL`); return; }
  if (parsed.protocol !== 'https:') errors.push(`${path}: must use https`);
  if (!parsed.hostname || parsed.username || parsed.password) errors.push(`${path}: must have a public host and no credentials`);
  if (/[\u0000-\u001f\u007f\s]/u.test(value)) errors.push(`${path}: whitespace is not allowed`);
}

function validatePrivateIpv4(value, path, errors) {
  if (!stringError(value, path, errors, { pattern: /^\d+(?:\.\d+){3}$/ })) return;
  const parts = value.split('.');
  const octets = parts.map(Number);
  if (octets.some((octet, index) => !/^(?:0|[1-9]\d{0,2})$/.test(parts[index]) || octet > 255)) {
    errors.push(`${path}: must contain four octets between 0 and 255`);
    return;
  }
  const privateNetwork = octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (!privateNetwork) errors.push(`${path}: must be an RFC1918 private IPv4 address`);
}

function validateProject(value, errors) {
  const path = 'site.project';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, PROJECT_KEYS, errors);
  stringError(value.displayName, `${path}.displayName`, errors, { min: 1, max: 96 });
  const shortName = typeof value.shortName === 'string' ? value.shortName.trim() : value.shortName;
  stringError(shortName, `${path}.shortName`, errors, { max: 64, pattern: SHORT_NAME_RE, trim: false });
  validateRepository(value.repository, `${path}.repository`, errors);
  validateHttpsUrl(value.blogUrl, `${path}.blogUrl`, errors);
}

function validateCatalog(value, errors) {
  const path = 'site.catalog';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, CATALOG_KEYS, errors);
  validateRepository(value.repository, `${path}.repository`, errors);
  stringError(value.releaseTag, `${path}.releaseTag`, errors, { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/ });

  const selection = value.selection;
  if (!isRecord(selection)) errors.push(`${path}.selection: must be an object`);
  else {
    addUnknownAndMissing(selection, `${path}.selection`, SELECTION_KEYS, errors);
    arrayError(selection.sourcePriority, `${path}.selection.sourcePriority`, errors,
      { item: (entry, entryPath, list) => stringError(entry, entryPath, list, { pattern: IDENTIFIER_RE }) });
    stringError(selection.defaultSource, `${path}.selection.defaultSource`, errors, { pattern: IDENTIFIER_RE });
    if (Array.isArray(selection.sourcePriority) && typeof selection.defaultSource === 'string' &&
        !selection.sourcePriority.includes(selection.defaultSource)) {
      errors.push(`${path}.selection.defaultSource: must be included in sourcePriority`);
    }
    arrayError(selection.developmentBranches, `${path}.selection.developmentBranches`, errors,
      { item: (entry, entryPath, list) => stringError(entry, entryPath, list, { pattern: BRANCH_RE }) });

    const preferredTarget = selection.preferredTarget;
    if (!isRecord(preferredTarget)) errors.push(`${path}.selection.preferredTarget: must be an object`);
    else {
      addUnknownAndMissing(preferredTarget, `${path}.selection.preferredTarget`, TARGET_KEYS, errors);
      const selectors = preferredTarget.selectors;
      if (!isRecord(selectors)) errors.push(`${path}.selection.preferredTarget.selectors: must be an object`);
      else {
        addUnknownAndMissing(selectors, `${path}.selection.preferredTarget.selectors`, SELECTOR_KEYS, errors);
        for (const key of SELECTOR_KEYS) {
          stringError(selectors[key], `${path}.selection.preferredTarget.selectors.${key}`, errors, { pattern: SYMBOL_RE });
        }
      }
    }
  }

  const loading = value.loading;
  if (!isRecord(loading)) errors.push(`${path}.loading: must be an object`);
  else {
    addUnknownAndMissing(loading, `${path}.loading`, LOADING_KEYS, errors);
    for (const key of ['startup', 'idle']) {
      arrayError(loading[key], `${path}.loading.${key}`, errors,
        { item: (entry, entryPath, list) => stringError(entry, entryPath, list, { pattern: TASK_RE }) });
    }
    numberError(loading.startupConcurrency, `${path}.loading.startupConcurrency`, errors, 1, 16);
    numberError(loading.idleConcurrency, `${path}.loading.idleConcurrency`, errors, 1, 16);
    numberError(loading.idleDelayMs, `${path}.loading.idleDelayMs`, errors, 0, 60000);
  }
}

function validateUi(value, errors) {
  const path = 'site.ui';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, UI_KEYS, errors);
  enumError(value.defaultLanguage, `${path}.defaultLanguage`, errors, LANGUAGES);
  enumError(value.colorMode, `${path}.colorMode`, errors, COLOR_MODES);
}

function validateFirmware(value, errors) {
  const path = 'site.firmware';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, FIRMWARE_KEYS, errors);
  validatePrivateIpv4(value.lanIp, `${path}.lanIp`, errors);

  const timezone = value.timezone;
  if (!isRecord(timezone)) errors.push(`${path}.timezone: must be an object`);
  else {
    addUnknownAndMissing(timezone, `${path}.timezone`, TIMEZONE_KEYS, errors);
    stringError(timezone.zonename, `${path}.timezone.zonename`, errors, { pattern: ZONENAME_RE });
    stringError(timezone.timezone, `${path}.timezone.timezone`, errors, { pattern: TIMEZONE_RE });
  }

  stringError(value.theme, `${path}.theme`, errors, { pattern: THEME_RE });
  const ntp = value.ntp;
  if (!isRecord(ntp)) errors.push(`${path}.ntp: must be an object`);
  else {
    addUnknownAndMissing(ntp, `${path}.ntp`, NTP_KEYS, errors);
    enumError(ntp.preset, `${path}.ntp.preset`, errors, NTP_PRESETS);
    arrayError(ntp.servers, `${path}.ntp.servers`, errors, {
      min: 4,
      max: 4,
      item: (entry, entryPath, list) => stringError(entry, entryPath, list, { pattern: HOSTNAME_RE }),
    });
  }
  stringError(value.packageMirror, `${path}.packageMirror`, errors, { pattern: IDENTIFIER_RE });
}

function validateSite(value, errors) {
  if (!isRecord(value)) { errors.push('site config: must be an object'); return; }
  addUnknownAndMissing(value, 'site config', SITE_TOP_LEVEL_KEYS, errors);
  validateProject(value.project, errors);
  validateCatalog(value.catalog, errors);
  validateUi(value.ui, errors);
  validateFirmware(value.firmware, errors);
  const build = value.build;
  if (!isRecord(build)) errors.push('site.build: must be an object');
  else {
    addUnknownAndMissing(build, 'site.build', BUILD_KEYS, errors);
    stringError(build.defaultTag, 'site.build.defaultTag', errors, { max: 160 });
  }
}

function uniqueErrors(errors) {
  return [...new Set(errors)];
}

/** Return public syntax/shape issues without consulting runtime authorities. */
export function siteConfigErrors(value) {
  const errors = [];
  validateSite(value, errors);
  return uniqueErrors(errors);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Normalize and validate the nested canonical site document. */
export function normalizeSiteConfig(value) {
  const errors = siteConfigErrors(value);
  if (errors.length) throw new Error(`Site configuration is invalid:\n- ${errors.join('\n- ')}`);
  const normalized = clone(value);
  normalized.project.shortName = normalized.project.shortName.trim();
  return normalized;
}

export const validateSiteConfig = normalizeSiteConfig;

export function isValidSiteConfig(value) {
  return siteConfigErrors(value).length === 0;
}

/** Return the legacy in-memory shape consumed by existing browser modules. */
export function siteRuntimeConfig(value) {
  const site = normalizeSiteConfig(value);
  const repositoryUrl = `https://github.com/${site.project.repository}`;
  const catalogUrl = `https://github.com/${site.catalog.repository}`;
  const actionsUrl = `${repositoryUrl}/actions`;
  return {
    schema: SITE_CONFIG_SCHEMA,
    name: site.project.displayName,
    shortName: site.project.shortName,
    repository: site.project.repository,
    repositoryUrl,
    actionsUrl,
    catalogRepository: site.catalog.repository,
    catalogUrl,
    blogUrl: site.project.blogUrl,
    catalogReleaseTag: site.catalog.releaseTag,
    catalogSelectionPolicy: clone(site.catalog.selection),
    catalogLoadPolicy: clone(site.catalog.loading),
    links: {
      repository: repositoryUrl,
      actions: actionsUrl,
      blog: site.project.blogUrl,
      catalog: catalogUrl,
    },
    customization: {
      ui: clone(site.ui),
      firmware: clone(site.firmware),
      build: clone(site.build),
    },
  };
}

export const toSiteRuntimeConfig = siteRuntimeConfig;
export const projectToRuntimeConfig = siteRuntimeConfig;
