#!/bin/bash
# Shared non-blocking package-mirror framework for APK and OPKG builds.
# JSON owns source families, origins, adapters, mirrors and fallback policy;
# the Node engine performs detection, probing and atomic edits.

apply_package_mirror() {
  local workspace helper_root rules engine report requested source branch
  helper_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  workspace="${WRT_WORKSPACE:-${GITHUB_WORKSPACE:-$helper_root}}"
  rules="$workspace/config/001.presets/package-mirrors.json"
  engine="$workspace/tools/package-mirror-engine.mjs"
  report="${WRT_PACKAGE_MIRROR_REPORT:-$workspace/package-mirror-report.json}"
  requested="${WRT_PACKAGE_MIRROR_ID:-${WRT_OPKG_ID:-source-default}}"
  source="${WRT_SOURCE_ID:-unknown}"
  branch="${WRT_BRANCH:-unknown}"

  if [ ! -f "$rules" ] || [ ! -f "$engine" ]; then
    echo "::warning::Package mirror framework is unavailable; keeping the upstream package source."
    return 0
  fi

  local -a args=(
    "$engine"
    --root "$PWD"
    --rules "$rules"
    --source "$source"
    --branch "$branch"
    --requested "$requested"
    --report "$report"
  )
  if [ -n "${WRT_PACKAGE_MIRROR_PROBE_RESULTS:-}" ]; then
    args+=(--probe-results "$WRT_PACKAGE_MIRROR_PROBE_RESULTS")
  fi

  if ! node "${args[@]}"; then
    echo "::warning::Package mirror setup failed internally; keeping the upstream package source and continuing."
    node - "$report" "$requested" "$source" "$branch" <<'NODE' || true
const fs = require('fs');
const path = require('path');
const [report, requested, source, branch] = process.argv.slice(2);
fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
fs.writeFileSync(report, JSON.stringify({
  schema: 1,
  requested,
  effective: 'source-default',
  source,
  branch,
  family: 'unknown',
  packageManagers: ['unknown'],
  changedFiles: [],
  attempts: [{ id: requested, result: 'internal-error', probes: [] }],
  fallback: true,
  status: 'internal-error-fallback',
}, null, 2) + '\n');
NODE
  fi

  if [ -s "$report" ]; then
    mkdir -p files/etc
    node - "$report" files/etc/weig-build-info <<'NODE'
const fs = require('fs');
const [reportPath, infoPath] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const value = (name, fallback = '') => String(process.env[name] || fallback).replace(/[\r\n]/g, '');
const lines = [
  `build_ref=${value('WRT_BUILD_REF', 'unknown')}`,
  `page_version=${value('WRT_PAGE_VERSION', 'unknown')}`,
  `zonename=${value('WRT_ZONENAME', 'Asia/Shanghai')}`,
  `timezone=${value('WRT_TIMEZONE', 'CST-8')}`,
  `theme=${value('WRT_THEME', 'luci-theme-bootstrap')}`,
  `ntp=${value('WRT_NTP_ID', 'cn')}`,
  `ntp_servers=${[1, 2, 3, 4].map((index) => value(`WRT_NTP_${index}`)).filter(Boolean).join(' ')}`,
  `package_mirror_requested=${report.requested}`,
  `package_mirror_effective=${report.effective}`,
  `package_managers=${(report.packageManagers || ['unknown']).join(',')}`,
];
fs.writeFileSync(infoPath, lines.join('\n') + '\n');
NODE
  fi

  return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  apply_package_mirror
fi
