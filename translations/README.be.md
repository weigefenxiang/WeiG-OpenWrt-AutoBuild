# Wei.G OpenWrt — наладжвайце прашыўку анлайн

Выберыце прыладу і пакеты ў браўзеры, адпраўце запыт праз GitHub, а зборку прашыўкі OpenWrt выканае воблачны сэрвіс.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Зручна на тэлефоне · 🌙 Светлая і цёмная тэмы · ✅ Розныя сістэмы на аснове OpenWrt**

**[🌐 Адкрыць канфігуратар](https://www.weigshare.com/wrt/) · [⬇️ Спампаваць прашыўку](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Падтрымліваюцца:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Мова:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Іншыя мовы</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; **Беларуская** &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Папярэдні прагляд інтэрфейсу

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Пачатак працы: тры крокі да прашыўкі

**📖 [Поўны дапаможнік з малюнкамі](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Абярыце крыніцу, прыладу і пакеты

Адкрыйце [**【Анлайн-канфігуратар】**](https://www.weigshare.com/wrt/) і выберыце **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Адзначце патрэбныя пакеты, пры неабходнасці змяніце **【Advanced menuconfig】**, часавы пояс і тэму. Праз **【Загрузіць канфігурацыю】** можна імпартаваць `build-request.json`, `.config` або `config.buildinfo`. Праверце налады перад працягам.

### 2. Адпраўце запыт на зборку праз GitHub

Спачатку [**【увайдзіце ў GitHub】**](https://github.com/login), вярніцеся ў [**【Канфігуратар】**](https://www.weigshare.com/wrt/) і выберыце **【Адправіць воблачную зборку】** → **【Спампаваць запыт і адкрыць GitHub】**. Браўзер спампуе `*.json` і адкрые форму GitHub Issue. На камп’ютары перацягніце JSON у поле запыту і націсніце **【Submit new issue】**. Бот адкажа спасылкай на зборку.

<details>
<summary><strong>Важныя заўвагі (разгарнуць)</strong></summary>

> Праверце налады і сумяшчальнасць кнопкай **【Тэст】** на плаваючай панэлі справа ўнізе. Пры стварэнні запыту праверка адбываецца і аўтаматычна.
>
> Калі знойдзены памылкі, прымяніце рэкамендаванае выпраўленне або выберыце **【Захаваць і прымусова працягнуць】**. Гэта не выправіць памылкі зыходнага кода і зборка можа скончыцца няўдала.
>
> Выкарыстоўвайце форму GitHub Issue, адкрытую канфігуратарам, каб не згубіць загадзя запоўненыя звесткі.
>
> Само спампаванне JSON **не запускае зборку** — Issue трэба адправіць.
>
> Не публікуйце сапраўдныя паролі, токены і іншыя сакрэты ў адкрытых Issues, запытах або журналах.

</details>

### 3. Спампуйце прашыўку

Скарыстайцеся спасылкай з Issue або старонкай [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Пасля паспяховага выканання спампуйце прашыўку ў **【Artifacts】**. `CONFIG` — файлы налад, `BUILD-LOGS` — журналы; **яны не з’яўляюцца выявамі прашыўкі для ўсталявання**. Файлы захоўваюцца **60 дзён**.

## Частыя пытанні

<details>
<summary>Чаму для вялікай колькасці пакетаў бракуе месца RootFS?</summary>

Пакеты з залежнасцямі могуць перавысіць памер раздзела RootFS. Калі прылада дазваляе, змяніце `TARGET_ROOTFS_PARTSIZE` у **【Advanced menuconfig】** → **【Target Images】**, напрыклад на 512 або 1024 MiB. На некаторых маршрутызатарах раздзелы flash фіксаваныя, таму прыбярыце пакеты. Прыклады: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Чаму доўгая зборка спыняецца?</summary>

Звычайны Job на GitHub-hosted Runner мае абмежаванне шэсць гадзін. Праект задае **350 хвілін** і спыняе выкананне пасля **335 хвілін**, каб захаваць журналы. Гэта **спыненне, а не паўза для аднаўлення**.

</details>

<details>
<summary>Як знайсці прычыну няўдалай зборкі?</summary>

Спампуйце `BUILD-LOGS` з **【Artifacts】** і прачытайце спачатку `00-SUMMARY.txt`. Праверце RootFS, час і памылкі крыніц ды залежнасцей. Глядзіце [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Пасля выпраўлення стварыце **новае Issue**.

</details>

<details>
<summary>Ці магу я запусціць стары Run з новымі наладамі?</summary>

Не. Стары Run выкарыстоўвае зыходны запыт, код і даныя. Праверце новую канфігурацыю ў бягучым канфігуратары і стварыце новы запыт.

</details>

## Распрацоўка і разгортванне

Для працы з сайтам не патрэбныя кланаванне рэпазіторыя і Node.js. Тэхнічныя звесткі па-англійску: [дапаможнік распрацоўшчыка](../docs/DEVELOPER.md) і [апісанне архітэктуры](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) публікуе галіны зыходнага кода, профілі прылад, пакеты, залежнасці Kconfig і звесткі пра сумяшчальнасць.

## Падзякі

Дзякуем [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [і ўсім аўтарам пакетаў і ўдзельнікам](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Ліцэнзія

Праект распаўсюджваецца паводле [GNU GPLv3 або навейшай](../LICENSE). Аўтарскія правы і кантакты — у [NOTICE](../NOTICE).
