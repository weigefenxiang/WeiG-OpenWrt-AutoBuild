#!/bin/bash
# Generic settings for catalog targets across OpenWrt-family branches.
set -e

: "${WRT_ZONENAME:=Asia/Shanghai}"
: "${WRT_TIMEZONE:=CST-8}"
: "${WRT_NTP_1:=ntp.aliyun.com}"
: "${WRT_NTP_2:=time1.cloud.tencent.com}"
: "${WRT_NTP_3:=cn.ntp.org.cn}"
: "${WRT_NTP_4:=cn.pool.ntp.org}"
: "${WRT_NTP_ID:=cn}"
: "${WRT_THEME:=luci-theme-bootstrap}"
: "${WRT_OPKG_ID:=auto}"
: "${WRT_OPKG_MIRROR:=@default}"
: "${WRT_PAGE_VERSION:=unknown}"
: "${WRT_BUILD_REF:=unknown}"

case "$WRT_THEME" in
  luci-theme-openwrt-2020) WRT_THEME_MEDIA="openwrt2020" ;;
  luci-theme-*) WRT_THEME_MEDIA="${WRT_THEME#luci-theme-}" ;;
  *) WRT_THEME_MEDIA="bootstrap" ;;
esac

mkdir -p files/etc/uci-defaults
printf '%s\n' \
  '#!/bin/sh' \
  "uci -q set system.@system[0].zonename='$WRT_ZONENAME'" \
  "uci -q set system.@system[0].timezone='$WRT_TIMEZONE'" \
  'uci -q delete system.ntp.server' \
  "uci -q add_list system.ntp.server='$WRT_NTP_1'" \
  "uci -q add_list system.ntp.server='$WRT_NTP_2'" \
  "uci -q add_list system.ntp.server='$WRT_NTP_3'" \
  "uci -q add_list system.ntp.server='$WRT_NTP_4'" \
  'uci -q commit system' \
  "uci -q set luci.main.mediaurlbase='/luci-static/$WRT_THEME_MEDIA'" \
  'uci -q commit luci' \
  'exit 0' > files/etc/uci-defaults/10-weig-system
chmod +x files/etc/uci-defaults/10-weig-system
printf 'build_ref=%s\npage_version=%s\nzonename=%s\ntimezone=%s\ntheme=%s\nntp=%s\nntp_servers=%s %s %s %s\nopkg=%s\nopkg_mirror=%s\n' \
  "$WRT_BUILD_REF" "$WRT_PAGE_VERSION" "$WRT_ZONENAME" "$WRT_TIMEZONE" "$WRT_THEME" \
  "$WRT_NTP_ID" "$WRT_NTP_1" "$WRT_NTP_2" "$WRT_NTP_3" "$WRT_NTP_4" \
  "$WRT_OPKG_ID" "$WRT_OPKG_MIRROR" > files/etc/weig-build-info

if [ -f feeds/luci/collections/luci/Makefile ] &&
   grep -q 'luci-theme-[A-Za-z0-9._+-]*' feeds/luci/collections/luci/Makefile; then
  sed -i -E "0,/luci-theme-[A-Za-z0-9._+-]+/s//$WRT_THEME/" feeds/luci/collections/luci/Makefile
fi
if [ "$WRT_OPKG_MIRROR" != "@default" ]; then
  OPKG_FILE="package/base-files/files/etc/opkg/distfeeds.conf"
  APK_VERSION_FILE="include/version.mk"
  if [ -f "$OPKG_FILE" ]; then
    sed -i -E \
      -e "s#https?://downloads\\.(openwrt|immortalwrt)\\.org/#https://$WRT_OPKG_MIRROR/#g" \
      -e "s#https?://[^/]+/(openwrt|immortalwrt)/#https://$WRT_OPKG_MIRROR/#g" \
      "$OPKG_FILE"
    grep -Fq "$WRT_OPKG_MIRROR" "$OPKG_FILE" || {
      echo "Selected opkg mirror was not written: $WRT_OPKG_MIRROR" >&2
      exit 1
    }
  elif [ -f "$APK_VERSION_FILE" ] && [ -f include/feeds.mk ] &&
       grep -Fq 'FeedSourcesAppendAPK' include/feeds.mk; then
    sed -i -E "s#^VERSION_REPO:=\\$\\(if \\$\\(VERSION_REPO\\),\\$\\(VERSION_REPO\\),https?://[^)]*\\)#VERSION_REPO:=https://$WRT_OPKG_MIRROR#" "$APK_VERSION_FILE"
    grep -Fx "VERSION_REPO:=https://$WRT_OPKG_MIRROR" "$APK_VERSION_FILE" >/dev/null || {
      echo "Selected APK mirror was not written: $WRT_OPKG_MIRROR" >&2
      exit 1
    }
    echo "Selected APK mirror will generate distfeeds.list: $WRT_OPKG_MIRROR"
  else
    echo "Selected package mirror cannot be applied: no opkg distfeeds.conf or APK feed generator" >&2
    exit 1
  fi
fi
