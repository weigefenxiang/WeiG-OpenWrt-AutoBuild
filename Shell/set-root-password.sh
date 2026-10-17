#!/usr/bin/env bash
# One late first-boot override for every source; never edit upstream defaults.
set -euo pipefail
tree="${1:?OpenWrt source tree is required}"
password="${REQUEST_ROOT_PASSWORD:-}"
if [ -z "$password" ]; then
  case "${PASSWORD_MODE:-prompt}" in
    empty) password='@empty' ;;
    secret) password="${DEFAULT_ROOT_PASSWORD:?DEFAULT_ROOT_PASSWORD is required}" ;;
    prompt) exit 0 ;;
    *) echo 'Invalid password mode' >&2; exit 1 ;;
  esac
fi
hash=''
if [ "$password" != '@empty' ]; then
  [[ "$password" =~ ^[A-Za-z0-9@#%^\&*_+=.,:!?-]{4,32}$ ]] || { echo 'Invalid initial password' >&2; exit 1; }
  printf '::add-mask::%s\n' "$password"
  hash="$(printf '%s' "$password" | openssl passwd -6 -stdin)"
  [[ "$hash" == '$6$'* ]] || { echo 'Unable to derive root password hash' >&2; exit 1; }
  printf '::add-mask::%s\n' "$hash"
fi
mkdir -p "$tree/files/etc/uci-defaults"
# Numeric defaults and zzz-default-settings must finish first. An empty shadow
# field is portable across old/new BusyBox passwd implementations.
script="$tree/files/etc/uci-defaults/zzzz-weig-password"
printf '%s\n' '#!/bin/sh' "sed -i 's|^root:[^:]*:|root:${hash}:|' /etc/shadow || exit 1" 'exit 0' > "$script"
chmod +x "$script"
unset password hash REQUEST_ROOT_PASSWORD DEFAULT_ROOT_PASSWORD
echo 'Late initial password override created / 已生成末序初始密码覆盖'
