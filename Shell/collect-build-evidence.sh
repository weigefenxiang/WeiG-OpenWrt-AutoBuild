#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 snapshot <stage> <build-log> <openwrt-root> <output-root>" >&2
  exit 2
}

[ "${1:-}" = "snapshot" ] || usage
stage="${2:-}"
log_file="${3:-}"
openwrt_root="${4:-}"
out_root="${5:-}"
[ -n "$stage" ] && [ -n "$log_file" ] && [ -n "$openwrt_root" ] && [ -n "$out_root" ] || usage
case "$stage" in
  parallel|diagnostic) ;;
  *) echo "Unsupported evidence stage: $stage" >&2; exit 2 ;;
esac

stage_dir="$out_root/$stage"
mkdir -p "$stage_dir"

if [ -s "$log_file" ]; then
  cp "$log_file" "$stage_dir/build.log"
else
  : > "$stage_dir/build.log"
fi

# Generic build-error extraction only. Never encode package/source/device-specific names here.
grep -nEi '(^|[^A-Za-z])(error:|undefined reference|No rule to make target|failed to build|out of space|No space left on device)|make\[[0-9]+\].*(Error|failed)' \
  "$stage_dir/build.log" 2>/dev/null | tail -n 120 > "$stage_dir/errors.txt" || true

grep -E 'make\[[0-9]+\].*(Error|failed)' "$stage_dir/build.log" 2>/dev/null | tail -n 30 \
  > "$stage_dir/last-targets.txt" || true

tail -n 250 "$stage_dir/build.log" > "$stage_dir/tail.txt" 2>/dev/null || true

if [ -d "$openwrt_root/logs" ]; then
  tar czf "$stage_dir/package-logs.tar.gz" -C "$openwrt_root" logs || true
fi

printf '%s\n' \
  "stage=$stage" \
  "log=$(basename "$log_file")" \
  "package_logs=$([ -f "$stage_dir/package-logs.tar.gz" ] && echo yes || echo no)" \
  > "$stage_dir/evidence.txt"
