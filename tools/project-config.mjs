#!/usr/bin/env node
// Canonical project configuration validation and projections.
// config/project.json is the only editable source for project-wide defaults.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(MODULE_PATH), '..');
export const DEFAULT_PROJECT_CONFIG_PATH = join(ROOT, 'config', 'project.json');
export const DEFAULT_PROJECT_SCHEMA_PATH = join(ROOT, 'config', 'project.schema.json');
export const DEFAULT_TIMEZONE_DATA_PATH = join(ROOT, 'site', 'wrt', 'data', 'timezones.json');
export const DEFAULT_PACKAGE_MIRROR_POLICY_PATH = join(ROOT, 'config', 'policies', 'package-mirrors.json');
export const DEFAULT_TIMEZONE_AUTHORITY_PATH = DEFAULT_TIMEZONE_DATA_PATH;
export const DEFAULT_PACKAGE_MIRROR_AUTHORITY_PATH = DEFAULT_PACKAGE_MIRROR_POLICY_PATH;

// This is intentionally internal to the generated public contract. It is not
// project customization and therefore does not belong in the canonical schema.
export const CATALOG_DATA_BRANCHES = Object.freeze({
  fixDefault: 'catalog-dev',
  fixOverrides: Object.freeze({}),
  dev: 'catalog-dev',
  staging: 'catalog-staging',
  main: 'catalog-main',
});

const TOP_LEVEL_KEYS = ['project', 'catalog', 'ui', 'firmware', 'build', 'admission'];
const PROJECT_KEYS = ['displayName', 'shortName', 'repository', 'blogUrl'];
const CATALOG_KEYS = ['repository', 'releaseTag', 'selection', 'loading'];
const SELECTION_KEYS = ['sourcePriority', 'defaultSource', 'developmentBranches', 'preferredTarget'];
const TARGET_KEYS = ['selectors'];
const SELECTOR_KEYS = ['system', 'subtarget', 'profile'];
const LOADING_KEYS = ['startup', 'idle', 'startupConcurrency', 'idleConcurrency', 'idleDelayMs'];
const UI_KEYS = ['defaultLanguage', 'colorMode'];
const FIRMWARE_KEYS = ['lanIp', 'timezone', 'theme', 'ntp', 'packageMirror', 'password'];
const TIMEZONE_KEYS = ['zonename', 'timezone'];
const NTP_KEYS = ['preset', 'servers'];
const PASSWORD_KEYS = ['mode'];
const BUILD_KEYS = ['defaultTag', 'compileJobs', 'downloadJobs'];
const ADMISSION_KEYS = ['publicActiveBuilds'];

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
const PASSWORD_MODES = new Set(['prompt', 'empty', 'secret']);
const JOB_MODES = new Set(['auto']);
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
  // JSON can carry all Unicode characters, but generated shell and public data
  // must never contain control bytes.
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

function readAuthorityJson(path, label, errors) {
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (error) {
    errors.push(`${label} (${path}): cannot read authority file: ${error.message}`);
    return null;
  }
  try { return JSON.parse(text); }
  catch (error) {
    errors.push(`${label} (${path}): invalid JSON: ${error.message}`);
    return null;
  }
}

function validateTimezoneAuthority(path = DEFAULT_TIMEZONE_DATA_PATH) {
  const errors = [];
  const label = 'timezone authority';
  const value = readAuthorityJson(path, label, errors);
  if (value === null) return { errors, rows: null };
  if (!isRecord(value)) {
    errors.push(`${label}: must be an object`);
    return { errors, rows: null };
  }
  if (value.version !== 1) errors.push(`${label}.version: must be 1`);
  if (!Array.isArray(value.zones)) {
    errors.push(`${label}.zones: must be an array`);
    return { errors, rows: null };
  }
  if (!value.zones.length) errors.push(`${label}.zones: must contain at least 1 item`);
  const pairs = new Set();
  const rows = [];
  value.zones.forEach((row, index) => {
    const rowPath = `${label}.zones[${index}]`;
    if (!isRecord(row)) {
      errors.push(`${rowPath}: must be an object`);
      return;
    }
    const zonenameOk = stringError(row.zonename, `${rowPath}.zonename`, errors, { pattern: ZONENAME_RE });
    const timezoneOk = stringError(row.timezone, `${rowPath}.timezone`, errors, { pattern: TIMEZONE_RE });
    if (!zonenameOk || !timezoneOk || typeof row.zonename !== 'string' || typeof row.timezone !== 'string' ||
        !ZONENAME_RE.test(row.zonename) || !TIMEZONE_RE.test(row.timezone)) return;
    const pair = `${row.zonename}\u0000${row.timezone}`;
    if (pairs.has(pair)) errors.push(`${rowPath}: duplicate timezone pair`);
    pairs.add(pair);
    rows.push({ zonename: row.zonename, timezone: row.timezone });
  });
  return { errors, rows: errors.length ? null : rows };
}

function validatePackageMirrorAuthority(path = DEFAULT_PACKAGE_MIRROR_POLICY_PATH) {
  const errors = [];
  const label = 'package mirror authority';
  const value = readAuthorityJson(path, label, errors);
  if (value === null) return { errors, presetIds: null };
  if (!isRecord(value)) {
    errors.push(`${label}: must be an object`);
    return { errors, presetIds: null };
  }
  if (value.schema !== 2) errors.push(`${label}.schema: must be 2`);
  const presets = value.presets;
  const presetIds = new Set();
  if (!Array.isArray(presets)) errors.push(`${label}.presets: must be an array`);
  else {
    if (!presets.length) errors.push(`${label}.presets: must contain at least 1 item`);
    presets.forEach((preset, index) => {
      const presetPath = `${label}.presets[${index}]`;
      if (!isRecord(preset)) {
        errors.push(`${presetPath}: must be an object`);
        return;
      }
      stringError(preset.id, `${presetPath}.id`, errors, { pattern: IDENTIFIER_RE });
      if (typeof preset.id === 'string') {
        if (presetIds.has(preset.id)) errors.push(`${presetPath}.id: duplicate preset id`);
        presetIds.add(preset.id);
      }
    });
  }
  return { errors, presetIds: errors.length ? null : presetIds };
}

/** Load and strictly validate the runtime authority documents used by defaults. */
export function loadProjectAuthorities({
  timezonePath = DEFAULT_TIMEZONE_DATA_PATH,
  packageMirrorPath = DEFAULT_PACKAGE_MIRROR_POLICY_PATH,
} = {}) {
  const timezone = validateTimezoneAuthority(timezonePath);
  const packageMirrors = validatePackageMirrorAuthority(packageMirrorPath);
  return {
    errors: [...timezone.errors, ...packageMirrors.errors],
    timezoneRows: timezone.rows,
    packagePresetIds: packageMirrors.presetIds,
  };
}

function validateProject(value, errors) {
  const path = 'project';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, PROJECT_KEYS, errors);
  stringError(value.displayName, `${path}.displayName`, errors, { min: 1, max: 96 });
  const shortName = typeof value.shortName === 'string' ? value.shortName.trim() : value.shortName;
  stringError(shortName, `${path}.shortName`, errors, { max: 64, pattern: SHORT_NAME_RE, trim: false });
  validateRepository(value.repository, `${path}.repository`, errors);
  validateHttpsUrl(value.blogUrl, `${path}.blogUrl`, errors);
}

function validateCatalog(value, errors) {
  const path = 'catalog';
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
        for (const key of SELECTOR_KEYS) stringError(selectors[key], `${path}.selection.preferredTarget.selectors.${key}`, errors, { pattern: SYMBOL_RE });
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
  const path = 'ui';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, UI_KEYS, errors);
  enumError(value.defaultLanguage, `${path}.defaultLanguage`, errors, LANGUAGES);
  enumError(value.colorMode, `${path}.colorMode`, errors, COLOR_MODES);
}

function validateFirmware(value, errors, authorities) {
  const path = 'firmware';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, FIRMWARE_KEYS, errors);
  validatePrivateIpv4(value.lanIp, `${path}.lanIp`, errors);

  const timezone = value.timezone;
  if (!isRecord(timezone)) errors.push(`${path}.timezone: must be an object`);
  else {
    addUnknownAndMissing(timezone, `${path}.timezone`, TIMEZONE_KEYS, errors);
    const zonenameOk = stringError(timezone.zonename, `${path}.timezone.zonename`, errors, { pattern: ZONENAME_RE });
    const timezoneOk = stringError(timezone.timezone, `${path}.timezone.timezone`, errors, { pattern: TIMEZONE_RE });
    if (authorities?.timezoneRows && zonenameOk && timezoneOk && typeof timezone.zonename === 'string' &&
        typeof timezone.timezone === 'string' && ZONENAME_RE.test(timezone.zonename) && TIMEZONE_RE.test(timezone.timezone) &&
        !authorities.timezoneRows.some((row) => row.zonename === timezone.zonename && row.timezone === timezone.timezone)) {
      errors.push(`${path}.timezone: must match an exact zonename/timezone pair in timezone authority`);
    }
  }

  stringError(value.theme, `${path}.theme`, errors, { pattern: THEME_RE });
  const ntp = value.ntp;
  if (!isRecord(ntp)) errors.push(`${path}.ntp: must be an object`);
  else {
    addUnknownAndMissing(ntp, `${path}.ntp`, NTP_KEYS, errors);
    enumError(ntp.preset, `${path}.ntp.preset`, errors, NTP_PRESETS);
    arrayError(ntp.servers, `${path}.ntp.servers`, errors, {
      min: 4, max: 4,
      item: (entry, entryPath, list) => stringError(entry, entryPath, list, { pattern: HOSTNAME_RE }),
    });
  }

  const packageMirrorOk = stringError(value.packageMirror, `${path}.packageMirror`, errors, { pattern: IDENTIFIER_RE });
  if (authorities?.packagePresetIds && packageMirrorOk && typeof value.packageMirror === 'string' &&
      IDENTIFIER_RE.test(value.packageMirror) && !authorities.packagePresetIds.has(value.packageMirror)) {
    errors.push(`${path}.packageMirror: must be a canonical package mirror preset id`);
  }
  const password = value.password;
  if (!isRecord(password)) errors.push(`${path}.password: must be an object`);
  else {
    addUnknownAndMissing(password, `${path}.password`, PASSWORD_KEYS, errors);
    enumError(password.mode, `${path}.password.mode`, errors, PASSWORD_MODES);
  }
}

function validateJobCount(value, path, errors) {
  if (typeof value === 'string') {
    if (!JOB_MODES.has(value)) errors.push(`${path}: must be auto or an integer from 1 to 32`);
    return;
  }
  numberError(value, path, errors, 1, 32);
}

function validateBuild(value, errors) {
  const path = 'build';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, BUILD_KEYS, errors);
  stringError(value.defaultTag, `${path}.defaultTag`, errors, { min: 0, max: 160 });
  validateJobCount(value.compileJobs, `${path}.compileJobs`, errors);
  validateJobCount(value.downloadJobs, `${path}.downloadJobs`, errors);
}

function validateAdmission(value, errors) {
  const path = 'admission';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, ADMISSION_KEYS, errors);
  numberError(value.publicActiveBuilds, `${path}.publicActiveBuilds`, errors, 1, 20);
}

/** Return every validation issue without mutating the supplied value. */
export function projectConfigErrors(value, options = {}) {
  const errors = [];
  if (!isRecord(value)) {
    errors.push('project config: must be an object');
    return errors;
  }
  const authorities = options.authorities || loadProjectAuthorities(options);
  errors.push(...(authorities.errors || []));
  addUnknownAndMissing(value, 'project config', TOP_LEVEL_KEYS, errors);
  validateProject(value.project, errors);
  validateCatalog(value.catalog, errors);
  validateUi(value.ui, errors);
  validateFirmware(value.firmware, errors, authorities);
  validateBuild(value.build, errors);
  validateAdmission(value.admission, errors);
  return [...new Set(errors)];
}

/** Validate and return a detached normalized copy of the canonical config. */
export function validateProjectConfig(value, options = {}) {
  const errors = projectConfigErrors(value, options);
  if (errors.length) throw new Error(`Project configuration is invalid:\n- ${errors.join('\n- ')}`);
  const normalized = JSON.parse(JSON.stringify(value));
  normalized.project.shortName = normalized.project.shortName.trim();
  return normalized;
}

export function isValidProjectConfig(value, options = {}) {
  return projectConfigErrors(value, options).length === 0;
}

export function parseProjectConfig(text, source = DEFAULT_PROJECT_CONFIG_PATH, options = {}) {
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`${source}: invalid JSON: ${error.message}`); }
  try { return validateProjectConfig(value, options); }
  catch (error) { throw new Error(`${source}: ${error.message}`); }
}

export function loadProjectConfig(source = DEFAULT_PROJECT_CONFIG_PATH, options = {}) {
  let text;
  try { text = readFileSync(source, 'utf8'); }
  catch (error) { throw new Error(`${source}: ${error.message}`); }
  return parseProjectConfig(text, source, options);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build the browser-facing projection while preserving its established flat
 * fields. Customization remains grouped so the public file is self-describing
 * without changing the existing Catalog loader contract.
 */
export function projectToSiteData(config) {
  const value = validateProjectConfig(config);
  return {
    schema: 1,
    name: value.project.displayName,
    shortName: value.project.shortName,
    repository: value.project.repository,
    catalogRepository: value.catalog.repository,
    blogUrl: value.project.blogUrl,
    catalogReleaseTag: value.catalog.releaseTag,
    catalogSelectionPolicy: clone(value.catalog.selection),
    catalogLoadPolicy: clone(value.catalog.loading),
    catalogDataBranches: clone(CATALOG_DATA_BRANCHES),
    customization: {
      ui: clone(value.ui),
      firmware: clone(value.firmware),
      build: clone(value.build),
      admission: clone(value.admission),
    },
  };
}

// Named aliases make the projection API convenient to use from small tools.
export const createSiteProject = projectToSiteData;
export const publicProjectData = projectToSiteData;

function shellValue(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('`', '\\`')
    .replaceAll('}', '\\}');
}

function shellDefault(name, value) {
  return ': "${' + name + ':=' + shellValue(value) + '}"';
}

/** Generate the source-safe Bash defaults consumed by DIY scripts. */
export function projectToBuildDefaults(config) {
  const value = validateProjectConfig(config);
  const firmware = value.firmware;
  const lines = [
    '# shellcheck shell=bash',
    '#',
    '# Generated from config/project.json; edit the canonical JSON source instead.',
    '# Generated by tools/gen-project-config.mjs.',
    '#',
    '# 构建默认值统一配置 / Unified build defaults.',
    '# 只允许纯 bash 变量赋值 / Plain Bash parameter defaults only.',
    '',
    shellDefault('WRT_LAN_IP', firmware.lanIp),
    shellDefault('WRT_ZONENAME', firmware.timezone.zonename),
    shellDefault('WRT_TIMEZONE', firmware.timezone.timezone),
    shellDefault('WRT_THEME', firmware.theme),
    shellDefault('WRT_NTP_ID', firmware.ntp.preset),
    ...firmware.ntp.servers.map((server, index) => shellDefault(`WRT_NTP_${index + 1}`, server)),
    shellDefault('WRT_PACKAGE_MIRROR_ID', firmware.packageMirror),
    shellDefault('WRT_PASSWORD_MODE', firmware.password.mode),
    shellDefault('WRT_DEFAULT_TAG', value.build.defaultTag),
    shellDefault('WRT_COMPILE_JOBS', value.build.compileJobs),
    shellDefault('WRT_DOWNLOAD_JOBS', value.build.downloadJobs),
    shellDefault('WRT_PUBLIC_ACTIVE_BUILDS', value.admission.publicActiveBuilds),
    '',
  ];
  return lines.join('\n');
}

export const buildDefaultsText = projectToBuildDefaults;
