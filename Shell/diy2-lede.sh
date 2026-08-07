#!/bin/bash
#
# Lean LEDE(coolsnowwolf/lede)专用默认设置 / defaults for Lean's LEDE.
# lede 的目录结构与 ImmortalWrt 不同,所有 sed 都带存在性保护 / paths differ from ImmortalWrt, every sed is guarded.
#

# 任何命令失败立即终止,防止静默残缺;存在性保护改用 if 写法与 set -e 兼容 / Fail fast on any error; guards use `if` so they stay set-e-safe.
set -e

# 读取统一默认值;conf 缺失时由下方 := 兜底,lede 只用到 IP 与时区 / Load shared defaults; := fallbacks below cover a missing conf — lede only uses the LAN IP and timezone
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

CG=package/base-files/files/bin/config_generate

# 默认 IP $WRT_LAN_IP(lede 默认 192.168.1.1,保险再写一次)/ default LAN IP, kept explicit
if [ -f "$CG" ]; then sed -i "s/192.168.[0-9]\{1,3\}.1/$WRT_LAN_IP/g" "$CG"; fi

# 时区 $WRT_TIMEZONE / timezone
if [ -f "$CG" ]; then sed -i "s/UTC/$WRT_TIMEZONE/g" "$CG"; fi
mkdir -p files/etc/uci-defaults
printf '#!/bin/sh\nuci -q set system.@system[0].zonename='\\''%s'\\''\nuci -q set system.@system[0].timezone='\\''%s'\\''\nuci -q commit system\nexit 0\n' \
  "$WRT_ZONENAME" "$WRT_TIMEZONE" > files/etc/uci-defaults/10-weig-timezone

# 固件主题与 NTP / firmware theme and NTP
if [ -f feeds/luci/collections/luci/Makefile ]; then
  sed -i "s/luci-theme-bootstrap/$WRT_THEME/g" feeds/luci/collections/luci/Makefile
fi
if [ -f "$CG" ]; then
  sed -i "s/0.openwrt.pool.ntp.org/$WRT_NTP_1/g; s/1.openwrt.pool.ntp.org/$WRT_NTP_2/g; s/2.openwrt.pool.ntp.org/$WRT_NTP_3/g; s/3.openwrt.pool.ntp.org/$WRT_NTP_4/g" "$CG"
fi

echo '--- lede default settings applied ---'
