#!/usr/bin/env node
// Parses only the immutable build routing identity from an Issue body.

import { appendFileSync, readFileSync } from 'node:fs';
import {
  buildEnvironmentIdentity,
  parseBuildIssueTitleIdentity,
  parseBuildRequestRouteMarker,
} from '../site/wrt/lib/build-identity.js';

function fail(message) {
  console.error(`Build route validation failed / 构建路由校验失败: ${message}`);
  process.exit(1);
}

function readIssueBody() {
  if (typeof process.env.ISSUE_BODY === 'string' && process.env.ISSUE_BODY !== '') {
    return process.env.ISSUE_BODY;
  }
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!eventPath) return '';
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    return String(event.issue?.body || '');
  } catch (error) {
    fail(`cannot read GitHub event payload: ${error.message}`);
  }
}

const title = String(process.env.ISSUE_TITLE || '').trim();
const route = parseBuildRequestRouteMarker(readIssueBody());
if (route.error) fail(route.error);

const titleIdentity = parseBuildIssueTitleIdentity(title);
if (!titleIdentity.requestId) fail('Issue title does not contain a valid build request id');
const routeIdentity = buildEnvironmentIdentity(route.sourceEnv);
if (titleIdentity.sourceEnv !== routeIdentity) {
  fail(`Issue title route does not match marker: title=${titleIdentity.sourceEnv || 'main'}, route=${routeIdentity || 'main'}`);
}

const lines = [
  `request_branch=${route.sourceEnv}`,
  `request_commit=${route.requestCommit}`,
  `request_id=${titleIdentity.requestId}`,
];
const output = String(process.env.GITHUB_OUTPUT || '').trim();
if (output) appendFileSync(output, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
