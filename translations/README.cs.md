# Wei.G OpenWrt – sestavte si firmware online

V prohlížeči vyberte zařízení a balíčky, odešlete požadavek přes GitHub a kompilaci firmwaru OpenWrt nechte na cloudu.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Přizpůsobeno mobilům · 🌙 Světlý i tmavý režim · ✅ Více variant OpenWrt**

**[🌐 Otevřít konfigurátor](https://www.weigshare.com/wrt/) · [⬇️ Stáhnout firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Podporované systémy:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Jazyk:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Další jazyky</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; **Čeština** &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Ukázka rozhraní

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Začínáme: firmware ve třech krocích

**📖 [Podrobný obrazový návod](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Zvolte zdroj, zařízení a balíčky

Otevřete [**【Online konfigurátor】**](https://www.weigshare.com/wrt/) a postupně zvolte **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Vyberte balíčky a podle potřeby upravte **【Advanced menuconfig】**, časové pásmo a vzhled. Tlačítkem **【Načíst konfiguraci】** lze importovat `build-request.json`, `.config` nebo `config.buildinfo`. Před pokračováním volby zkontrolujte.

### 2. Odešlete požadavek na sestavení přes GitHub

Nejprve se [**【přihlaste ke GitHubu】**](https://github.com/login). Vraťte se do [**【Konfigurátoru】**](https://www.weigshare.com/wrt/) a vyberte **【Odeslat cloudové sestavení】** → **【Stáhnout žádost a otevřít GitHub】**. Prohlížeč stáhne `*.json` a otevře formulář GitHub Issue. Na počítači přetáhněte JSON do pole žádosti a klikněte na **【Submit new issue】**. Bot odpoví odkazem na sestavení.

<details>
<summary><strong>Důležité poznámky (rozbalit)</strong></summary>

> Nastavení a doporučení kompatibility lze předem prověřit tlačítkem **【Test】** v plovoucí liště vpravo dole. Kontrola se spustí také automaticky při vytvoření žádosti.
>
> Při problémech použijte navrženou opravu nebo zvolte **【Ponechat a vynutit pokračování】**. Tím se neodstraní chyby upstream zdrojů a sestavení může selhat.
>
> Použijte formulář GitHub Issue, který otevře konfigurátor, aby zůstaly zachovány předvyplněné údaje.
>
> Samotné stažení JSON bez odeslání Issue **sestavení nespustí**.
>
> Do veřejných Issues, žádostí ani logů nezadávejte skutečná hesla, tokeny či jiná tajemství.

</details>

### 3. Stáhněte firmware

Otevřete odkaz v Issue nebo [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Po úspěšném běhu stáhněte firmware v sekci **【Artifacts】**. `CONFIG` jsou konfigurace a `BUILD-LOGS` diagnostické protokoly; **nejde o obrazy firmwaru k nahrání do zařízení**. Soubory zůstávají dostupné **60 dní**.

## Časté dotazy

<details>
<summary>Proč při velkém počtu balíčků nestačí RootFS?</summary>

Balíčky a závislosti mohou překročit kapacitu oddílu RootFS. Pokud to zařízení umožňuje, najděte `TARGET_ROOTFS_PARTSIZE` v **【Advanced menuconfig】** → **【Target Images】** a nastavte například 512 nebo 1024 MiB. Některé fyzické směrovače mají pevné rozdělení flash: odeberte nepotřebné balíčky. Viz [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Proč se dlouhé sestavení ukončí?</summary>

Jeden Job na GitHub-hosted runneru obvykle smí trvat nejvýše šest hodin. Projekt používá limit **350 minut** a běh ukončí po **335 minutách**, aby zbýval čas na logy. **Nejde o pozastavení, ve kterém lze pokračovat**.

</details>

<details>
<summary>Jak zjistím příčinu neúspěšného sestavení?</summary>

Stáhněte `BUILD-LOGS` v **【Artifacts】** a začněte souborem `00-SUMMARY.txt`. Zkontrolujte RootFS, časový limit, zdrojový kód i závislosti. Pomoci může [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Po opravě odešlete **nové Issue**.

</details>

<details>
<summary>Mohu po změně konfigurace opakovat starý Run?</summary>

Ne. Starý Run používá původní požadavek i uzamčené verze kódu a dat. V aktuálním konfigurátoru načtěte změny a vytvořte nové Issue.

</details>

## Vývoj a nasazení

Pro běžné sestavení není nutné klonovat repozitář ani instalovat Node.js. Technické podrobnosti jsou v anglické [příručce pro vývojáře](../docs/DEVELOPER.md) a [popisu architektury](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publikuje zdrojové větve, profily zařízení, balíčky, vztahy Kconfig a informace o kompatibilitě pro web i sestavovací službu.

## Poděkování

Děkujeme projektům [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [a všem autorům balíčků a přispěvatelům](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licence

Projekt je šířen pod licencí [GNU GPLv3 nebo novější](../LICENSE). Informace o autorech a kontaktech najdete v [NOTICE](../NOTICE).
