# Wei.G OpenWrt — stel je firmware online samen

Kies je apparaat en pakketten in de browser, dien een aanvraag in op GitHub en laat OpenWrt-firmware in de cloud bouwen.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Geschikt voor mobiel · 🌙 Licht en donker thema · ✅ Verschillende OpenWrt-varianten**

**[🌐 Configurator openen](https://www.weigshare.com/wrt/) · [⬇️ Firmware downloaden](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Ondersteund:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Taal:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Meer talen</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; **Nederlands** &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Voorbeeld van de interface

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Aan de slag: firmware bouwen in drie stappen

**📖 [Uitgebreide handleiding met afbeeldingen](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Broncode, apparaat en pakketten kiezen

Open de [**【Online configurator】**](https://www.weigshare.com/wrt/) en kies **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Selecteer de gewenste pakketten en pas zo nodig **【Advanced menuconfig】**, tijdzone en thema aan. Met **【Configuratie laden】** kun je ook `build-request.json`, `.config` of `config.buildinfo` importeren; controleer daarna je instellingen.

### 2. De cloudbuild via GitHub aanvragen

[**【Log eerst in bij GitHub】**](https://github.com/login), keer terug naar de [**【Configurator】**](https://www.weigshare.com/wrt/) en kies **【Cloudbuild indienen】** → **【Aanvraag downloaden en GitHub openen】**. Er wordt een `*.json`-bestand gedownload en een GitHub Issue-formulier geopend. Sleep op een computer de JSON naar het verzoekveld en klik op **【Submit new issue】**. De bot plaatst vervolgens een link naar de build in je Issue.

<details>
<summary><strong>Belangrijke opmerkingen (uitklappen)</strong></summary>

> Met **【Test】** in de zwevende werkbalk rechtsonder controleer je vooraf configuratiefouten en compatibiliteit. Ook bij het downloaden van de aanvraag draait deze controle automatisch.
>
> Bij problemen kun je de voorgestelde oplossing toepassen of **【Behouden en toch doorgaan】** kiezen. Dit verhelpt geen fouten in de upstream-broncode en garandeert geen succesvolle build.
>
> Gebruik het Issue-formulier dat de configurator automatisch opent, zodat vooraf ingevulde gegevens behouden blijven.
>
> Alleen een JSON-bestand downloaden **start geen build**. Je moet het Issue daadwerkelijk indienen.
>
> Publiceer nooit echte wachtwoorden, tokens of andere gevoelige gegevens in openbare Issues, aanvragen of logs.

</details>

### 3. Firmware downloaden

Open de build via de link in je Issue of via [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Download na een geslaagde run de firmware bij **【Artifacts】** onderaan. `CONFIG` bevat instellingen en `BUILD-LOGS` diagnosegegevens: **dit zijn geen firmware-images om te flashen**. Bestanden blijven **60 dagen** beschikbaar.

## Veelgestelde vragen

<details>
<summary>Waarom raakt RootFS vol als ik veel pakketten kies?</summary>

Pakketten en afhankelijkheden kunnen te groot zijn voor de RootFS-partitie. Bij apparaten die het ondersteunen kun je onder **【Advanced menuconfig】** → **【Target Images】** de optie `TARGET_ROOTFS_PARTSIZE` aanpassen, bijvoorbeeld naar 512 of 1024 MiB. Veel fysieke routers hebben vaste flashpartities; verwijder in dat geval pakketten. Zie [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Waarom wordt mijn build afgebroken vanwege de tijdslimiet?</summary>

Een GitHub-hosted Runner heeft per Job normaal maximaal zes uur. Dit project hanteert een limiet van **350 minuten** en beëindigt de uitvoering na **335 minuten** zodat de logs nog kunnen worden verzameld. De build **stopt en kan niet later worden hervat**. Grote afhankelijkheden zoals Node.js of Rust kosten extra tijd.

</details>

<details>
<summary>Wat kan ik doen als de build mislukt?</summary>

Download `BUILD-LOGS` onder **【Artifacts】** en lees eerst `00-SUMMARY.txt`. Onderzoek of RootFS, de tijdslimiet, broncode of afhankelijkheden de oorzaak zijn. Zie [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Dien na een wijziging een **nieuw Issue** in.

</details>

<details>
<summary>Kan ik een oude Run opnieuw uitvoeren met nieuwe instellingen?</summary>

Nee. Een oude Run gebruikt de oorspronkelijke aanvraag en de toen vastgelegde code en data. Laad je wijzigingen opnieuw in de configurator, controleer ze en maak een nieuw Issue.

</details>

## Ontwikkeling en uitrol

Voor een firmwarebuild via de website hoef je de repository niet te klonen of Node.js te installeren. Technische informatie vind je in de Engelstalige [ontwikkelaarsgids](../docs/DEVELOPER.md) en [architectuurbeschrijving](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) levert gegevens over bronbranches, apparaatprofielen, pakketten, Kconfig-afhankelijkheden en compatibiliteit aan zowel de website als de build-worker. AutoBuild houdt geen tweede apparaat- of pakketdatabase bij.

## Dankwoord

Dank aan [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [en aan alle pakketmakers en bijdragers](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licentie

Dit project valt onder de [GNU GPLv3 of een latere versie](../LICENSE). Auteursrechten en contactgegevens staan in [NOTICE](../NOTICE).
