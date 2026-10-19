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

**Distributioner som stöds:** [<img src="../docs/images/sources/immortalwrt.svg" alt="ImmortalWrt" align="absmiddle">](https://github.com/immortalwrt/immortalwrt) · [<img src="../docs/images/sources/lede.svg" alt="Lean LEDE" align="absmiddle">](https://github.com/coolsnowwolf/lede) · [<img src="../docs/images/sources/openwrt.svg" alt="OpenWrt" align="absmiddle">](https://github.com/openwrt/openwrt) · [<img src="../docs/images/sources/istoreos.svg" alt="iStoreOS" align="absmiddle">](https://github.com/istoreos/istoreos) · [<img src="../docs/images/sources/lienol.svg" alt="Lienol" align="absmiddle">](https://github.com/Lienol/openwrt) · [<img src="../docs/images/sources/hanwckf.svg" alt="ImmortalWrt (hanwckf MT798x)" align="absmiddle">](https://github.com/hanwckf/immortalwrt-mt798x)

**Språk:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Fler språk</b></summary>

<div dir="ltr">
<a href="README.ast.md">Asturianu</a> &lrm;·&lrm; <a href="README.az.md">Azərbaycanca</a> &lrm;·&lrm; <a href="README.be.md">Беларуская</a> &lrm;·&lrm; <a href="README.bg.md">Български</a> &lrm;·&lrm; <a href="README.bn.md">বাংলা</a> &lrm;·&lrm; <a href="README.bn-BD.md">বাংলা (বাংলাদেশ)</a> &lrm;·&lrm; <a href="README.ca.md">Català</a> &lrm;·&lrm; <a href="README.cs.md">Čeština</a> &lrm;·&lrm; <a href="README.da.md">Dansk</a> &lrm;·&lrm; <a href="README.el.md">Ελληνικά</a> &lrm;·&lrm; <a href="README.fi.md">Suomi</a> &lrm;·&lrm; <a href="README.fil.md">Filipino</a> &lrm;·&lrm; <a href="README.ga.md">Gaeilge</a> &lrm;·&lrm; <a href="README.hi.md">हिन्दी</a> &lrm;·&lrm; <a href="README.hu.md">Magyar</a> &lrm;·&lrm; <a href="README.id.md">Bahasa Indonesia</a> &lrm;·&lrm; <a href="README.it.md">Italiano</a> &lrm;·&lrm; <a href="README.ka.md">ქართული</a> &lrm;·&lrm; <a href="README.lo.md">ລາວ</a> &lrm;·&lrm; <a href="README.lt.md">Lietuvių</a> &lrm;·&lrm; <a href="README.lv.md">Latviešu</a> &lrm;·&lrm; <a href="README.ml.md">മലയാളം</a> &lrm;·&lrm; <a href="README.mr.md">मराठी</a> &lrm;·&lrm; <a href="README.ms.md">Bahasa Melayu</a> &lrm;·&lrm; <a href="README.nb-NO.md">Norsk bokmål</a> &lrm;·&lrm; <a href="README.nl.md">Nederlands</a> &lrm;·&lrm; <a href="README.pl.md">Polski</a> &lrm;·&lrm; <a href="README.pt-BR.md">Português (Brasil)</a> &lrm;·&lrm; <a href="README.ro.md">Română</a> &lrm;·&lrm; <a href="README.sk.md">Slovenčina</a> &lrm;·&lrm; <strong>Svenska</strong> &lrm;·&lrm; <a href="README.ta.md">தமிழ்</a> &lrm;·&lrm; <a href="README.tr.md">Türkçe</a> &lrm;·&lrm; <a href="README.uk.md">Українська</a> &lrm;·&lrm; <a href="README.ar.md">&#x2067;العربية&#x2069;</a> &lrm;·&lrm; <a href="README.fa.md">&#x2067;فارسی&#x2069;</a> &lrm;·&lrm; <a href="README.he.md">&#x2067;עברית&#x2069;</a> &lrm;·&lrm; <a href="README.ur.md">&#x2067;اردو&#x2069;</a>
</div>

</details>

## Förhandsgranskning av gränssnittet

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Kom igång: bygg firmware i tre steg

**📖 [Illustrerad steg-för-steg-guide](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Välj källkod, enhet och paket

Öppna [**【Konfiguratorn】**](https://www.weigshare.com/wrt/) och välj **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** i ordning. Markera paketen du behöver och justera vid behov **【Advanced menuconfig】**, tidszon och tema. Du kan också välja **【Läs in konfiguration】** och importera en konfigurationsfil i formatet `*.json`, `.config` eller `config.buildinfo`. Kontrollera källa, enhet och tillägg innan du fortsätter.

### 2. Skicka byggförfrågan via GitHub

[**【Logga först in på GitHub】**](https://github.com/login). Gå tillbaka till [**【Konfiguratorn】**](https://www.weigshare.com/wrt/) och välj **【Starta molnbygge】** → **【Ladda ned konfiguration och öppna GitHub】**. En `*.json`-fil sparas och ett GitHub Issue-formulär öppnas. På datorn laddar du upp den nyss hämtade JSON-filen genom att dra den till formulärets byggförfrågningsfält och klickar sedan på **【Submit new issue】**. Botten svarar i ärendet med en länk till bygget.

<details>
<summary><strong>Viktig information (visa)</strong></summary>

> Du kan kontrollera konfigurationsproblem och kompatibilitetsråd i förväg med **【Test】** i det flytande verktygsfältet längst ned till höger. **【Ladda ned konfiguration och öppna GitHub】** kör också förkontrollen automatiskt.
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

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) samlar in och publicerar källkodsgrenar, enhetsprofiler, paket, Kconfig-beroenden och kompatibilitetsuppgifter. Webbplatsen och byggsystemet använder samma data, så AutoBuild behöver ingen separat enhets- och paketdatabas.

## Tack

Tack till [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [samt alla paketförfattare och bidragsgivare](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licens

Projektet distribueras enligt [GNU GPLv3 eller senare](../LICENSE). Se [NOTICE](../NOTICE) för upphovsrätt och kontaktuppgifter.
