#!/usr/bin/env node
// Node loaders for the canonical site/build configuration documents.
// Public site syntax is shared with site/wrt/lib/site-config.js; this module
// adds only filesystem and cross-authority checks.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeSiteConfig as normalizePublicSiteConfig,
  siteConfigErrors as publicSiteConfigErrors,
} from '../site/wrt/lib/site-config.js';

const MODULE_PATH = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(MODULE_PATH), '..');

export const DEFAULT_SITE_CONFIG_PATH = join(ROOT, 'site', 'wrt', 'config', 'site.json');
export const DEFAULT_SITE_SCHEMA_PATH = join(ROOT, 'site', 'wrt', 'config', 'site.schema.json');
export const DEFAULT_BUILD_CONFIG_PATH = join(ROOT, 'config', 'build.json');
export const DEFAULT_BUILD_SCHEMA_PATH = join(ROOT, 'config', 'build.schema.json');
export const DEFAULT_TIMEZONE_DATA_PATH = join(ROOT, 'site', 'wrt', 'data', 'timezones.json');
export const DEFAULT_PACKAGE_MIRROR_POLICY_PATH = join(ROOT, 'config', 'policies', 'package-mirrors.json');
export const DEFAULT_TIMEZONE_AUTHORITY_PATH = DEFAULT_TIMEZONE_DATA_PATH;
export const DEFAULT_PACKAGE_MIRROR_AUTHORITY_PATH = DEFAULT_PACKAGE_MIRROR_POLICY_PATH;

const BUILD_TOP_LEVEL_KEYS = ['password', 'jobs', 'admission'];
const PASSWORD_KEYS = ['mode'];
const JOBS_KEYS = ['compile', 'download'];
const BUILD_ADMISSION_KEYS = ['publicActiveBuilds'];
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const PASSWORD_MODES = new Set(['prompt', 'empty', 'secret']);
const JOB_MODES = new Set(['auto']);
const ZONENAME_RE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+$/;
const TIMEZONE_RE = /^[A-Za-z0-9._+<>,:/-]{1,128}$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addUnknownAndMissing(value, path, keys, errors) {
  if (!isRecord(value)) return;
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unknown key`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: required`);
  }
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
  return true;
}

function validatePassword(value, errors) {
  const path = 'build.password';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, PASSWORD_KEYS, errors);
  enumError(value.mode, `${path}.mode`, errors, PASSWORD_MODES);
}

function validateJobCount(value, path, errors) {
  if (typeof value === 'string') {
    if (!JOB_MODES.has(value)) errors.push(`${path}: must be auto or an integer from 1 to 32`);
    return;
  }
  numberError(value, path, errors, 1, 32);
}

function validateJobs(value, errors) {
  const path = 'build.jobs';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, JOBS_KEYS, errors);
  validateJobCount(value.compile, `${path}.compile`, errors);
  validateJobCount(value.download, `${path}.download`, errors);
}

function validateBuildAdmission(value, errors) {
  const path = 'build.admission';
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  addUnknownAndMissing(value, path, BUILD_ADMISSION_KEYS, errors);
  numberError(value.publicActiveBuilds, `${path}.publicActiveBuilds`, errors, 1, 20);
}

function validateBuild(value, errors) {
  if (!isRecord(value)) { errors.push('build config: must be an object'); return; }
  addUnknownAndMissing(value, 'build config', BUILD_TOP_LEVEL_KEYS, errors);
  validatePassword(value.password, errors);
  validateJobs(value.jobs, errors);
  validateBuildAdmission(value.admission, errors);
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

// Only the fields required to validate site references are checked. The
// authority documents remain the sole owners of their unrelated runtime data.
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

/** Load and validate only the dynamic authorities referenced by site config. */
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

function siteErrorsWithAuthorities(value, authorities) {
  const errors = publicSiteConfigErrors(value);
  errors.push(...(authorities.errors || []));
  const timezone = value?.firmware?.timezone;
  if (Array.isArray(authorities.timezoneRows) && isRecord(timezone) &&
      typeof timezone.zonename === 'string' && typeof timezone.timezone === 'string' &&
      ZONENAME_RE.test(timezone.zonename) && TIMEZONE_RE.test(timezone.timezone) &&
      !authorities.timezoneRows.some((row) => row.zonename === timezone.zonename && row.timezone === timezone.timezone)) {
    errors.push('site.firmware.timezone: must match an exact zonename/timezone pair in timezone authority');
  }
  const packageMirror = value?.firmware?.packageMirror;
  if (authorities.packagePresetIds instanceof Set && typeof packageMirror === 'string' &&
      IDENTIFIER_RE.test(packageMirror) && !authorities.packagePresetIds.has(packageMirror)) {
    errors.push('site.firmware.packageMirror: must be a canonical package mirror preset id');
  }
  return [...new Set(errors)];
}

/** Return public site issues plus Node-only authority reference failures. */
export function siteConfigErrors(value, options = {}) {
  return siteErrorsWithAuthorities(value, options.authorities || loadProjectAuthorities(options));
}

/** Return all build configuration issues. */
export function buildConfigErrors(value) {
  const errors = [];
  validateBuild(value, errors);
  return [...new Set(errors)];
}

/** Return all issues across the site/build configuration pair. */
export function projectConfigurationErrors(value, options = {}) {
  const errors = [];
  if (!isRecord(value)) {
    errors.push('project configuration: must be an object');
    return errors;
  }
  const authorities = options.authorities || loadProjectAuthorities(options);
  errors.push(...siteErrorsWithAuthorities(value.site, authorities));
  errors.push(...(buildConfigErrors(value.build)));
  const known = new Set(['site', 'build']);
  for (const key of Object.keys(value)) if (!known.has(key)) errors.push(`project configuration.${key}: unknown key`);
  for (const key of known) if (!Object.hasOwn(value, key)) errors.push(`project configuration.${key}: required`);
  return [...new Set(errors)];
}

/** Validate and return a detached normalized site configuration. */
export function validateSiteConfig(value, options = {}) {
  const errors = siteConfigErrors(value, options);
  if (errors.length) throw new Error(`Site configuration is invalid:\n- ${errors.join('\n- ')}`);
  return normalizePublicSiteConfig(value);
}

/** Validate and return a detached normalized build configuration. */
export function validateBuildConfig(value) {
  const errors = buildConfigErrors(value);
  if (errors.length) throw new Error(`Build configuration is invalid:\n- ${errors.join('\n- ')}`);
  return JSON.parse(JSON.stringify(value));
}

/** Validate and return a detached normalized `{ site, build }` pair. */
export function validateProjectConfiguration(value, options = {}) {
  const errors = projectConfigurationErrors(value, options);
  if (errors.length) throw new Error(`Project configuration is invalid:\n- ${errors.join('\n- ')}`);
  return {
    site: normalizePublicSiteConfig(value.site),
    build: JSON.parse(JSON.stringify(value.build)),
  };
}

export function isValidSiteConfig(value, options = {}) {
  return siteConfigErrors(value, options).length === 0;
}

export function isValidBuildConfig(value) {
  return buildConfigErrors(value).length === 0;
}

export function isValidProjectConfiguration(value, options = {}) {
  return projectConfigurationErrors(value, options).length === 0;
}

function parseJsonDocument(text, source) {
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`${source}: invalid JSON: ${error.message}`); }
}

export function parseSiteConfig(text, source = DEFAULT_SITE_CONFIG_PATH, options = {}) {
  return validateSiteConfig(parseJsonDocument(text, source), options);
}

export function parseBuildConfig(text, source = DEFAULT_BUILD_CONFIG_PATH) {
  return validateBuildConfig(parseJsonDocument(text, source));
}

export function loadSiteConfig(source = DEFAULT_SITE_CONFIG_PATH, options = {}) {
  let text;
  try { text = readFileSync(source, 'utf8'); }
  catch (error) { throw new Error(`${source}: ${error.message}`); }
  return parseSiteConfig(text, source, options);
}

export function loadBuildConfig(source = DEFAULT_BUILD_CONFIG_PATH) {
  let text;
  try { text = readFileSync(source, 'utf8'); }
  catch (error) { throw new Error(`${source}: ${error.message}`); }
  return parseBuildConfig(text, source);
}

/** Load and validate both canonical documents as one configuration boundary. */
export function loadProjectConfiguration(options = {}) {
  if (typeof options === 'string') options = { siteSource: options };
  const siteSource = options.siteSource || options.sitePath || DEFAULT_SITE_CONFIG_PATH;
  const buildSource = options.buildSource || options.buildPath || DEFAULT_BUILD_CONFIG_PATH;
  let siteText;
  let buildText;
  try { siteText = readFileSync(siteSource, 'utf8'); }
  catch (error) { throw new Error(`${siteSource}: ${error.message}`); }
  try { buildText = readFileSync(buildSource, 'utf8'); }
  catch (error) { throw new Error(`${buildSource}: ${error.message}`); }
  const raw = {
    site: parseJsonDocument(siteText, siteSource),
    build: parseJsonDocument(buildText, buildSource),
  };
  try { return validateProjectConfiguration(raw, options); }
  catch (error) { throw new Error(`${siteSource} + ${buildSource}: ${error.message}`); }
}

// Compatibility aliases are API names only; they still validate the split
// `{ site, build }` structure and never restore a second canonical document.
export const projectConfigErrors = projectConfigurationErrors;
export const validateProjectConfig = validateProjectConfiguration;
export const isValidProjectConfig = isValidProjectConfiguration;

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

/** Generate source-safe Bash defaults from the site/build configuration pair. */
export function projectToBuildDefaults(configuration) {
  const value = validateProjectConfiguration(configuration);
  const firmware = value.site.firmware;
  const siteBuild = value.site.build;
  const build = value.build;
  const lines = [
    '# shellcheck shell=bash',
    '#',
    '# Generated from site/wrt/config/site.json and config/build.json.',
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
    shellDefault('WRT_PASSWORD_MODE', build.password.mode),
    shellDefault('WRT_DEFAULT_TAG', siteBuild.defaultTag),
    shellDefault('WRT_COMPILE_JOBS', build.jobs.compile),
    shellDefault('WRT_DOWNLOAD_JOBS', build.jobs.download),
    shellDefault('WRT_PUBLIC_ACTIVE_BUILDS', build.admission.publicActiveBuilds),
    '',
  ];
  return lines.join('\n');
}

export const buildDefaultsText = projectToBuildDefaults;
