#!/usr/bin/env node
// Reads only the immutable AutoBuild routing envelope from one build-request.json.
// It intentionally does not parse Catalog/Kconfig/build semantics; those belong to the branch worker.

import { appendFileSync, readFileSync } from 'node:fs';
import {
  buildActionRunTitle,
  buildEnvironmentIdentity,
  normalizeBuildCommit,
  normalizeBuildEnvironment,
  parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';

const REQUEST_ID_RE = /^\d{6}_\d{4}$/;

function fail(message) {
  console.error(`Build request identity validation failed / 构建请求身份校验失败: ${message}`);
  process.exit(1);
}

const manifestPath = String(process.env.REQUEST_MANIFEST || '').trim();
if (!manifestPath) fail('REQUEST_MANIFEST is required');

let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
catch (error) { fail(`cannot read request manifest: ${error.message}`); }
if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files)) fail('request manifest format is invalid');
if (manifest.files.length !== 1 || manifest.files[0]?.type !== 'json') {
  fail('branch-aware routing requires exactly one build-request.json');
}

let request;
try { request = JSON.parse(readFileSync(manifest.files[0].path, 'utf8')); }
catch (error) { fail(`cannot read build-request.json: ${error.message}`); }
if (!request || request.schema !== 5) fail(`unsupported build-request schema: ${JSON.stringify(request?.schema)} (schema 5 required)`);

const sourceEnv = normalizeBuildEnvironment(request.sourceEnv);
if (!sourceEnv || sourceEnv !== String(request.sourceEnv || '').trim().replace(/^refs\/heads\//, '').replace(/^origin\//, '')) {
  fail(`invalid sourceEnv: ${JSON.stringify(request.sourceEnv)}`);
}
const requestCommit = normalizeBuildCommit(request.requestCommit);
if (!requestCommit) fail('requestCommit must be a full 40-character Git commit');
const requestId = String(request.requestId || '').trim();
if (!REQUEST_ID_RE.test(requestId)) fail(`invalid requestId: ${JSON.stringify(request.requestId)}`);

const issueTitle = String(process.env.ISSUE_TITLE || '').trim();
const titleIdentity = parseBuildIssueTitleIdentity(issueTitle);
const requester = String(process.env.REQUESTER || '').trim();
const issueNumber = Number(process.env.ISSUE_NUMBER || '0');
if (issueTitle.startsWith('[build]')) {
  if (!titleIdentity.requestId) fail('Issue title does not contain a valid build request identity');
  const sourceIdentity = buildEnvironmentIdentity(sourceEnv);
  if (titleIdentity.sourceEnv !== sourceIdentity) {
    fail(`Issue title branch identity mismatch: request=${sourceIdentity || 'main'}, title=${titleIdentity.sourceEnv || 'main'}`);
  }
  if (titleIdentity.requestId !== requestId) {
    fail(`Issue title requestId mismatch: request=${requestId}, title=${titleIdentity.requestId}`);
  }
}

const runTitle = issueTitle.startsWith('[build]')
  ? buildActionRunTitle(requester, issueNumber, issueTitle, sourceEnv)
  : '';
if (issueTitle.startsWith('[build]') && !runTitle) fail('cannot format build Actions run title');

const lines = [
  `request_branch=${sourceEnv}`,
  `request_commit=${requestCommit}`,
  `request_id=${requestId}`,
  `run_title=${runTitle}`,
];
const output = String(process.env.GITHUB_OUTPUT || '').trim();
if (output) appendFileSync(output, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
