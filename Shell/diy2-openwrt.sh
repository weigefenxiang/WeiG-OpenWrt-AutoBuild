#!/bin/bash
#
# 官方 OpenWrt 专用默认设置脚本(DIY P2,feeds 安装后执行) / Default-settings script (DIY P2, runs after feeds install) dedicated to official OpenWrt.
# 注意:官方源里没有 ImmortalWrt 的 package/emortal/default-settings,也没有 luci-theme-argon / Note: the official tree has neither ImmortalWrt's package/emortal/default-settings nor luci-theme-argon,
# 所以不能复用 diy2-360T7*.sh(那些 sed 会失败) / so diy2-360T7*.sh cannot be reused here (its sed edits would fail).
#

# 任何命令失败立即终止,防止静默残缺 / Fail fast on any error — no silently broken tree.
set -e

# 读取统一默认值;conf 缺失时由下方 := 兜底,本源无主题/镜像操作,只兜底用到的变量 / Load shared defaults; := fallbacks below cover a missing conf — this source has no theme/mirror edits, so only the variables actually used are covered
WRT_DEFAULTS="$(dirname "${BASH_SOURCE[0]}")/build-defaults.conf"
if [ -f "$WRT_DEFAULTS" ]; then source "$WRT_DEFAULTS"; fi
: "${WRT_LAN_IP:=192.168.1.1}"
: "${WRT_ZONENAME:=Asia/Shanghai}"
: "${WRT_TIMEZONE:=CST-8}"
: "${WRT_NTP_1:=ntp.aliyun.com}"
: "${WRT_NTP_2:=time1.cloud.tencent.com}"
: "${WRT_NTP_3:=cn.ntp.org.cn}"
: "${WRT_NTP_4:=cn.pool.ntp.org}"
: "${WRT_THEME:=luci-theme-bootstrap}"
: "${WRT_OPKG_MIRROR:=@default}"

# 默认 LuCI 主题 / default LuCI theme
sed -i "s/luci-theme-bootstrap/$WRT_THEME/g" feeds/luci/collections/luci/Makefile

# 默认 IP $WRT_LAN_IP(官方本来就是,保险起见再写一次) / Default LAN IP $WRT_LAN_IP (already the official default; re-applied as a safeguard)
sed -i "s/192.168.[0-9]\{1,3\}.1/$WRT_LAN_IP/g" package/base-files/files/bin/config_generate

# 默认时区改为 $WRT_TIMEZONE(中国标准时间) / Set the default timezone to $WRT_TIMEZONE (China Standard Time)
sed -i "s/UTC/$WRT_TIMEZONE/g" package/base-files/files/bin/config_generate
mkdir -p files/etc/uci-defaults
printf '#!/bin/sh\nuci -q set system.@system[0].zonename='\\''%s'\\''\nuci -q set system.@system[0].timezone='\\''%s'\\''\nuci -q commit system\nexit 0\n' \
  "$WRT_ZONENAME" "$WRT_TIMEZONE" > files/etc/uci-defaults/10-weig-timezone

# NTP 换国内源,国内同步更快更稳 / Swap NTP servers for Chinese ones — faster and more reliable inside China
sed -i "s/0.openwrt.pool.ntp.org/$WRT_NTP_1/g" package/base-files/files/bin/config_generate
sed -i "s/1.openwrt.pool.ntp.org/$WRT_NTP_2/g" package/base-files/files/bin/config_generate
sed -i "s/2.openwrt.pool.ntp.org/$WRT_NTP_3/g" package/base-files/files/bin/config_generate
sed -i "s/3.openwrt.pool.ntp.org/$WRT_NTP_4/g" package/base-files/files/bin/config_generate

# opkg 镜像 / opkg mirror
if [ "$WRT_OPKG_MIRROR" != "@default" ]; then
  sed -i "s,downloads.openwrt.org,$WRT_OPKG_MIRROR,g" package/base-files/files/etc/opkg/distfeeds.conf
fi

echo '--- official OpenWrt default settings applied ---'
grep -n 'timezone\|ntp' package/base-files/files/bin/config_generate | head -20
