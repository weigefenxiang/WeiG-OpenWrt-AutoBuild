#!/bin/bash
#
# Copyright (c) 2023 @weigefenxiang
#

# 任何命令失败立即终止,防止静默残缺 / Fail fast on any error — no silently broken tree.
set -e

# 读取统一默认值;conf 缺失时由下方 := 兜底 / Load shared defaults; the := fallbacks below cover a missing conf
WRT_DEFAULTS="$(dirname "${BASH_SOURCE[0]}")/build-defaults.conf"
if [ -f "$WRT_DEFAULTS" ]; then source "$WRT_DEFAULTS"; fi
: "${WRT_LAN_IP:=192.168.1.1}"
: "${WRT_ZONENAME:=Asia/Shanghai}"
: "${WRT_TIMEZONE:=CST-8}"
: "${WRT_THEME:=luci-theme-argon}"
: "${WRT_NTP_1:=ntp.aliyun.com}"
: "${WRT_NTP_2:=time1.cloud.tencent.com}"
: "${WRT_NTP_3:=cn.ntp.org.cn}"
: "${WRT_NTP_4:=cn.pool.ntp.org}"
: "${WRT_OPKG_MIRROR:=@default}"

# name: 替换默认主题 $WRT_THEME
sed -i "s/luci-theme-bootstrap/$WRT_THEME/" feeds/luci/collections/luci/Makefile

# 默认ip $WRT_LAN_IP
sed -i "s/192.168.[0-9]\{1,3\}.1/$WRT_LAN_IP/g" package/base-files/files/bin/config_generate

# 修改时区 $WRT_TIMEZONE
sed -i "s/UTC/$WRT_TIMEZONE/g"  package/base-files/files/bin/config_generate
mkdir -p files/etc/uci-defaults
printf '#!/bin/sh\nuci -q set system.@system[0].zonename='\\''%s'\\''\nuci -q set system.@system[0].timezone='\\''%s'\\''\nuci -q commit system\nexit 0\n' \
  "$WRT_ZONENAME" "$WRT_TIMEZONE" > files/etc/uci-defaults/10-weig-timezone

# 时区
sed -i "s/time1.apple.com/$WRT_NTP_2/g"  package/base-files/files/bin/config_generate
sed -i "s/time1.google.com/$WRT_NTP_1/g"  package/base-files/files/bin/config_generate
sed -i "s/time.cloudflare.com/$WRT_NTP_3/g"  package/base-files/files/bin/config_generate
sed -i "s/pool.ntp.org/$WRT_NTP_4/g"  package/base-files/files/bin/config_generate

MIRROR_HELPER="$(dirname "${BASH_SOURCE[0]}")/apply-package-mirror.sh"
[ -f "$MIRROR_HELPER" ] || { echo "Package mirror helper is missing" >&2; exit 1; }
source "$MIRROR_HELPER"
apply_package_mirror
