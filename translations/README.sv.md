# Wei.G OpenWrt – anpassa firmware direkt i webbläsaren

Välj enhet och paket i webbläsaren, skicka en förfrågan via GitHub och låt molntjänsten bygga din OpenWrt-firmware.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Anpassad för mobilen · 🌙 Ljust och mörkt tema · ✅ Flera OpenWrt-baserade distributioner**

**[🌐 Öppna konfiguratorn](https://www.weigshare.com/wrt/) · [⬇️ Ladda ned firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distributioner som stöds:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Språk:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Fler språk</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; **Svenska** &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Förhandsgranskning av gränssnittet

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Kom igång: bygg firmware i tre steg

**📖 [Illustrerad steg-för-steg-guide](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Välj källkod, enhet och paket

Öppna [**【Konfiguratorn】**](https://www.weigshare.com/wrt/) och välj **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Markera paketen du behöver och justera vid behov **【Advanced menuconfig】**, tidszon och tema. Du kan också välja **【Läs in konfiguration】** och importera `build-request.json`, `.config` eller `config.buildinfo`. Kontrollera enhet och paket innan du fortsätter.

### 2. Skicka byggförfrågan via GitHub

[**【Logga först in på GitHub】**](https://github.com/login). Gå tillbaka till [**【Konfiguratorn】**](https://www.weigshare.com/wrt/) och välj **【Skicka molnbygge】** → **【Ladda ned förfrågan och öppna GitHub】**. En `*.json`-fil sparas och ett GitHub Issue-formulär öppnas. På datorn drar du JSON-filen till formulärets förfrågningsfält och klickar på **【Submit new issue】**. Botten svarar i ärendet med en länk till bygget.

<details>
<summary><strong>Viktig information (visa)</strong></summary>

> Du kan kontrollera konfigurationsproblem och kompatibilitetsråd i förväg med **【Test】** i det flytande verktygsfältet längst ned till höger. Kontrollen körs också automatiskt när du skapar förfrågan.
>
> Vid problem kan du använda det föreslagna alternativet eller välja **【Behåll och fortsätt ändå】**. Det rättar inte fel i uppströmskoden och bygget kan fortfarande misslyckas.
>
> Använd GitHub Issue-sidan som öppnas av konfiguratorn så att de förifyllda uppgifterna behålls.
>
> Att bara ladda ned JSON-filen **startar inget bygge**. Du måste skicka in ärendet.
>
> Publicera aldrig riktiga lösenord, åtkomsttoken eller annan känslig information i offentliga ärenden, förfrågningar eller loggar.

</details>

### 3. Ladda ned firmware

Öppna länken i GitHub-ärendet eller hitta körningen via [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). När den är klar laddar du ned firmware under **【Artifacts】** längst ned. `CONFIG` är konfiguration och `BUILD-LOGS` innehåller felsökningsloggar; **de är inte firmware-avbilder att flasha**. Filerna sparas i **60 dagar**.

## Vanliga frågor

<details>
<summary>Varför tar RootFS-utrymmet slut med många paket?</summary>

Paket och deras beroenden kan bli större än RootFS-partitionen. Om enheten tillåter det kan du ändra `TARGET_ROOTFS_PARTSIZE` under **【Advanced menuconfig】** → **【Target Images】**, exempelvis till 512 eller 1024 MiB. Många fysiska routrar har fasta flashpartitioner; ta då bort paket i stället. Se [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Varför avbryts ett bygge som tar lång tid?</summary>

Ett GitHub-hosted Runner-jobb får normalt ta högst sex timmar. Här är jobbgränsen **350 minuter**, med en exekveringsgräns efter **335 minuter** så att loggar hinner samlas in. Bygget **stoppas, det pausas inte för att fortsätta senare**. Stora beroenden som Node.js och Rust kan ta lång tid.

</details>

<details>
<summary>Hur felsöker jag ett misslyckat bygge?</summary>

Ladda ned `BUILD-LOGS` under **【Artifacts】** och börja med `00-SUMMARY.txt`. Undersök RootFS-utrymme, tidsgränser och fel i källkod eller beroenden. Se även [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Skapa ett **nytt Issue** efter en ändring.

</details>

<details>
<summary>Kan jag köra om ett gammalt Run efter att ha ändrat inställningarna?</summary>

Nej. Det gamla jobbet använder den ursprungliga förfrågan och de låsta kod- och dataversionerna. Läs in den nya konfigurationen och skapa en ny förfrågan.

</details>

## Utveckling och driftsättning

Vanliga användare behöver varken klona projektet eller installera Node.js. Teknisk dokumentation finns på engelska i [utvecklarguiden](../docs/DEVELOPER.md) och [arkitekturbeskrivningen](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) samlar in och publicerar källkodgrenar, enhetsprofiler, paket, Kconfig-beroenden och kompatibilitetsuppgifter. Webbplatsen och byggsystemet använder samma data, så AutoBuild behöver ingen separat enhets- och paketdatabas.

## Tack

Tack till [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [samt alla paketförfattare och bidragsgivare](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licens

Projektet distribueras enligt [GNU GPLv3 eller senare](../LICENSE). Se [NOTICE](../NOTICE) för upphovsrätt och kontaktuppgifter.
