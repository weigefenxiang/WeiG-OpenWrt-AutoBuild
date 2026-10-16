# Wei.G OpenWrt — i-customize ang firmware online

Piliin ang device at mga package sa browser, magsumite ng request sa GitHub, at hayaang buuin sa cloud ang OpenWrt firmware.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Madaling gamitin sa telepono · 🌙 Light at dark na tema · ✅ Iba’t ibang bersyon ng OpenWrt**

**[🌐 Buksan ang customizer](https://www.weigshare.com/wrt/) · [⬇️ I-download ang firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Mga suportadong system:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Wika:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Iba pang wika</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; **Filipino** &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Preview ng interface

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Magsimula: firmware sa tatlong hakbang

**📖 [Kumpletong gabay na may mga larawan](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Pumili ng source, device at package

Buksan ang [**【Online customizer】**](https://www.weigshare.com/wrt/) at piliin ang **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Markahan ang kailangan mong package at baguhin ang **【Advanced menuconfig】**, time zone at tema kung kinakailangan. Gamitin ang **【Load configuration】** para mag-import ng `build-request.json`, `.config` o `config.buildinfo`. Suriin ang mga pagpipilian bago magpatuloy.

### 2. Magpadala ng cloud build sa GitHub

[**【Mag-sign in sa GitHub】**](https://github.com/login) muna. Bumalik sa [**【Customizer】**](https://www.weigshare.com/wrt/) at pindutin ang **【Submit cloud build】** → **【Download request and open GitHub】**. Magda-download ng `*.json` at magbubukas ang GitHub Issue form. Sa desktop, i-drag ang JSON sa request field, saka i-click ang **【Submit new issue】**. Sasagot ang bot ng link sa build.

<details>
<summary><strong>Mahahalagang paalala (buksan)</strong></summary>

> I-click ang **【Test】** sa floating toolbar sa ibabang kanan para makita ang problema sa configuration at payo sa compatibility. Awtomatiko rin ang pag-check kapag gumagawa ng request.
>
> Kung may problema, ilapat ang inirekomendang pag-aayos o piliin ang **【Keep and force continue】**. Hindi nito inaayos ang bug sa upstream source at maaari pa ring pumalya ang build.
>
> Gamitin ang GitHub Issue page na awtomatikong binuksan ng customizer para hindi mawala ang prefilled na impormasyon.
>
> Hindi nagsisimula ang build sa pag-download lang ng JSON; **kailangan mong isumite ang Issue**.
>
> Huwag maglagay ng totoong password, token o sikreto sa public Issues, requests o logs.

</details>

### 3. I-download ang firmware

Sundan ang link sa Issue o buksan ang [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Kapag matagumpay, i-download ang firmware sa **【Artifacts】**. Mga configuration file ang `CONFIG` at diagnostic logs ang `BUILD-LOGS`; **hindi ang mga ito ang firmware na dapat i-flash**. Available ang mga file sa loob ng **60 araw**.

## Mga madalas itanong

<details>
<summary>Bakit nauubusan ng RootFS space kapag maraming package?</summary>

Maaaring lumampas ang mga package at dependency sa laki ng RootFS partition. Kung suportado ng device, hanapin ang `TARGET_ROOTFS_PARTSIZE` sa **【Advanced menuconfig】** → **【Target Images】** at itakda, halimbawa, sa 512 o 1024 MiB. Hindi nababago ang flash partition ng ilang physical router, kaya bawasan ang packages. Tingnan ang [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Bakit natitigil ang matagal na build?</summary>

Karaniwan, anim na oras ang limit ng isang Job sa GitHub-hosted Runner. Nakatakda rito ang **350 minuto** at tumitigil ang execution pagdating ng **335 minuto** para may oras sa logs. **Humihinto ito, hindi naka-pause para ituloy sa ibang pagkakataon**.

</details>

<details>
<summary>Paano aalamin kung bakit pumalya ang build?</summary>

I-download ang `BUILD-LOGS` sa **【Artifacts】** at unahing basahin ang `00-SUMMARY.txt`. Suriin ang RootFS, oras, upstream source at dependencies. Basahin ang [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Gumawa ng **bagong Issue** pagkatapos ng pagbabago.

</details>

<details>
<summary>Maaari bang ulitin ang lumang Run para sa bagong settings?</summary>

Hindi. Gagamitin ng lumang Run ang dati nitong request, code at data. I-load at suriin ang updated na configuration at magsumite ng bagong request.

</details>

## Development at deployment

Hindi kailangang i-clone ang repository o mag-install ng Node.js para gamitin ang website. Tingnan ang English na [developer guide](../docs/DEVELOPER.md) at [architecture document](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

Naglalathala ang [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) ng source branches, device profiles, packages, Kconfig dependencies at compatibility data para sa website at build worker.

## Pasasalamat

Salamat sa [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [at sa lahat ng package authors at contributors](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lisensya

Lisensyado ang proyekto sa [GNU GPLv3 o mas bago](../LICENSE). Nasa [NOTICE](../NOTICE) ang copyright at contact details.
