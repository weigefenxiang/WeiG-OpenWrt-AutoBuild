# Wei.G OpenWrt – tilpass fastvaren på nettet

Velg enhet og pakker i nettleseren, send en forespørsel via GitHub og la skyen bygge OpenWrt-fastvaren.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Tilpasset mobilen · 🌙 Lyst og mørkt tema · ✅ Flere OpenWrt-baserte systemer**

**[🌐 Åpne konfiguratoren](https://www.weigshare.com/wrt/) · [⬇️ Last ned fastvare](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Støttede systemer:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Språk:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Flere språk</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; **Norsk bokmål** &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Forhåndsvisning av grensesnittet

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Kom i gang: fastvare på tre trinn

**📖 [Komplett veiledning med bilder](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Velg kildekode, enhet og pakker

Åpne [**【Nettkonfiguratoren】**](https://www.weigshare.com/wrt/) og velg **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Merk av pakkene du trenger, og tilpass eventuelt **【Advanced menuconfig】**, tidssone og tema. Under **【Last inn konfigurasjon】** kan du importere `build-request.json`, `.config` eller `config.buildinfo`. Kontroller valgene før du går videre.

### 2. Send byggeforespørselen via GitHub

[**【Logg først inn på GitHub】**](https://github.com/login). Gå tilbake til [**【Konfiguratoren】**](https://www.weigshare.com/wrt/) og velg **【Send skybygg】** → **【Last ned forespørsel og åpne GitHub】**. Nettleseren laster ned en `*.json`-fil og åpner et GitHub Issue-skjema. På datamaskinen drar du JSON-filen til feltet og klikker **【Submit new issue】**. En bot svarer med lenken til byggejobben.

<details>
<summary><strong>Viktig informasjon (utvid)</strong></summary>

> Bruk **【Test】** i den flytende verktøylinjen nederst til høyre for å kontrollere oppsett og kompatibilitet på forhånd. Sjekken kjøres også automatisk når forespørselen opprettes.
>
> Ved problemer kan du bruke foreslått retting eller velge **【Behold og fortsett likevel】**. Det reparerer ikke feil i oppstrømskoden, og byggingen kan mislykkes.
>
> Bruk GitHub Issue-skjemaet som konfiguratoren åpner automatisk, slik at forhåndsutfylte opplysninger ikke forsvinner.
>
> Nedlasting av JSON alene **starter ikke byggingen**. Du må sende inn Issue.
>
> Ikke legg ut ekte passord, token eller andre hemmeligheter i offentlige Issues, forespørsler eller logger.

</details>

### 3. Last ned fastvaren

Følg lenken i Issue eller se [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Når byggingen er ferdig, laster du ned fastvaren fra **【Artifacts】** nederst. `CONFIG` inneholder innstillinger og `BUILD-LOGS` inneholder logger – **ingen av dem er fastvarefiler du kan flashe**. Filer lagres i **60 dager**.

## Vanlige spørsmål

<details>
<summary>Hvorfor går RootFS tom for plass med mange pakker?</summary>

Pakker og avhengigheter kan overskride størrelsen på RootFS-partisjonen. Hvis enheten støtter det, kan `TARGET_ROOTFS_PARTSIZE` endres under **【Advanced menuconfig】** → **【Target Images】**, for eksempel til 512 eller 1024 MiB. Mange fysiske rutere har faste flashpartisjoner; fjern unødvendige pakker. Se [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Hvorfor stopper en langvarig bygging?</summary>

Ett Job på en GitHub-hosted Runner har normalt maks seks timer. Prosjektet bruker **350 minutter** som grense og stopper kjøringen etter **335 minutter** for å samle logger. Dette er **stopp, ikke en pause du kan fortsette senere**.

</details>

<details>
<summary>Hvordan finner jeg årsaken til at byggingen feilet?</summary>

Last ned `BUILD-LOGS` under **【Artifacts】**, og les først `00-SUMMARY.txt`. Se etter RootFS-plass, tidsgrenser og feil i kildekode eller avhengigheter. Se [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Opprett et **nytt Issue** etter endringer.

</details>

<details>
<summary>Kan jeg starte en gammel Run på nytt med nye innstillinger?</summary>

Nei. En gammel Run bruker den opprinnelige forespørselen og de låste versjonene av kode og data. Last inn nye innstillinger i konfiguratoren og send inn en ny forespørsel.

</details>

## Utvikling og utrulling

Vanlige brukere trenger verken klone repoet eller installere Node.js. Teknisk dokumentasjon finnes på engelsk i [utviklerveiledningen](../docs/DEVELOPER.md) og [arkitekturoversikten](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publiserer kildegrener, enhetsprofiler, pakker, Kconfig-avhengigheter og kompatibilitetsdata for både nettsiden og byggesystemet.

## Takk til

Takk til [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [og alle pakkeforfattere og bidragsytere](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lisens

Prosjektet er lisensiert under [GNU GPLv3 eller nyere](../LICENSE). Se [NOTICE](../NOTICE) for opphavsrett og kontaktinformasjon.
