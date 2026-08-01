#!/bin/bash
# Shared package-feed mirror helper. Source this from diy2 scripts after feeds install.

apply_package_mirror() {
  [ "${WRT_OPKG_MIRROR:-@default}" = '@default' ] && return 0
  case "$WRT_OPKG_MIRROR" in
    *[!A-Za-z0-9._/-]*|'') echo "Invalid package mirror: $WRT_OPKG_MIRROR" >&2; return 1 ;;
  esac

  local root="https://$WRT_OPKG_MIRROR"
  local changed=0 file repo_url
  local sed_args=(
    -e "s#https\?://downloads\.openwrt\.org/#$root/#g"
    -e "s#https\?://downloads\.immortalwrt\.org/#$root/#g"
    -e "s#https\?://mirrors\.vsean\.net/openwrt/#$root/#g"
  )

  for file in package/base-files/files/etc/opkg/distfeeds.conf include/version.mk; do
    [ -f "$file" ] || continue
    sed -i -E "${sed_args[@]}" "$file"
    if grep -Fq "$WRT_OPKG_MIRROR" "$file"; then changed=1; fi
  done
  file=package/emortal/default-settings/files/99-default-settings-chinese
  if [ -f "$file" ]; then
    sed -i "s#mirrors.vsean.net/openwrt#$WRT_OPKG_MIRROR#g" "$file"
    if grep -Fq "$WRT_OPKG_MIRROR" "$file"; then changed=1; fi
  fi
  [ "$changed" = 1 ] || { echo "Selected package mirror cannot be applied: no known feed origin" >&2; return 1; }

  repo_url="$(grep -Eo 'https?://[^[:space:])]+' include/version.mk 2>/dev/null | grep -F "$root/" | head -1 || true)"
  if [ -n "$repo_url" ]; then
    curl -fsIL --connect-timeout 10 --max-time 30 "$repo_url/" >/dev/null || {
      echo "Selected package mirror has no feed for this source/branch: $repo_url" >&2
      return 1
    }
  fi
  echo "Selected package mirror applied: $WRT_OPKG_MIRROR"
}
