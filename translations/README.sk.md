# Wei.G OpenWrt – upravte si firmvér online

V prehliadači si vyberte zariadenie a balíky, odošlite požiadavku cez GitHub a nechajte firmvér OpenWrt zostaviť v cloude.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Prispôsobené mobilom · 🌙 Svetlá a tmavá téma · ✅ Viaceré varianty OpenWrt**

**[🌐 Otvoriť konfigurátor](https://www.weigshare.com/wrt/) · [⬇️ Stiahnuť firmvér](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Podporované systémy:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Jazyk:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Ďalšie jazyky</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; **Slovenčina** &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Ukážka rozhrania

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Začíname: firmvér v troch krokoch

**📖 [Kompletný obrázkový návod](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Vyberte zdroj, zariadenie a balíky

Otvorte [**【Online konfigurátor】**](https://www.weigshare.com/wrt/) a vyberte **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Označte potrebné balíky a podľa potreby upravte **【Advanced menuconfig】**, časové pásmo a tému. Pomocou **【Načítať konfiguráciu】** môžete importovať `build-request.json`, `.config` alebo `config.buildinfo`. Pred pokračovaním nastavenia skontrolujte.

### 2. Odošlite zostavenie cez GitHub

Najprv sa [**【prihláste do GitHubu】**](https://github.com/login), potom sa vráťte do [**【Konfigurátora】**](https://www.weigshare.com/wrt/). Zvoľte **【Odoslať cloudové zostavenie】** → **【Stiahnuť požiadavku a otvoriť GitHub】**. Prehliadač stiahne `*.json` a otvorí formulár GitHub Issue. Na počítači presuňte JSON do poľa žiadosti a kliknite na **【Submit new issue】**. Bot odpovie odkazom na zostavenie.

<details>
<summary><strong>Dôležité upozornenia (rozbaliť)</strong></summary>

> Konfiguráciu a odporúčania kompatibility môžete vopred preveriť tlačidlom **【Test】** na plávajúcej lište vpravo dole. Kontrola sa spúšťa automaticky aj pri vytvorení požiadavky.
>
> Pri problémoch prijmite navrhnuté riešenie alebo zvoľte **【Ponechať a vynútene pokračovať】**. Tým sa neopravia chyby zdrojového kódu a zostavenie môže zlyhať.
>
> Použite formulár GitHub Issue, ktorý konfigurátor otvorí automaticky, aby sa nestratili predvyplnené údaje.
>
> Samotné stiahnutie JSON bez odoslania Issue **nespustí zostavenie**.
>
> Do verejných Issues, požiadaviek alebo logov nevkladajte skutočné heslá, tokeny ani iné tajné údaje.

</details>

### 3. Stiahnite firmvér

Nasledujte odkaz v Issue alebo otvorte [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Po dokončení stiahnite firmvér zo sekcie **【Artifacts】**. `CONFIG` obsahuje nastavenia, `BUILD-LOGS` diagnostické záznamy – **nejde o obrazy firmvéru na nahratie do zariadenia**. Súbory sa uchovávajú **60 dní**.

## Často kladené otázky

<details>
<summary>Prečo veľa balíkov spôsobí nedostatok miesta v RootFS?</summary>

Balíky a závislosti môžu presiahnuť veľkosť oddielu RootFS. Ak to zariadenie podporuje, upravte `TARGET_ROOTFS_PARTSIZE` v **【Advanced menuconfig】** → **【Target Images】**, napríklad na 512 alebo 1024 MiB. Niektoré fyzické routery majú pevné oddiely flash a potrebujú menej balíkov. Príklady: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Prečo sa dlhé zostavenie ukončí?</summary>

Jeden Job na GitHub-hosted Runner zvyčajne môže trvať najviac šesť hodín. Tu je limit **350 minút** a beh sa končí po **335 minútach**, aby zostal čas na logy. **Nejde o pozastavenie, po ktorom možno pokračovať**.

</details>

<details>
<summary>Ako nájdem príčinu neúspešného zostavenia?</summary>

Stiahnite `BUILD-LOGS` zo sekcie **【Artifacts】** a najprv si prečítajte `00-SUMMARY.txt`. Skontrolujte RootFS, časový limit, zdrojový kód a závislosti. Pozrite [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Po zmene vytvorte **nové Issue**.

</details>

<details>
<summary>Môžem znova spustiť starý Run po zmene konfigurácie?</summary>

Nie. Starý Run používa pôvodnú požiadavku a uzamknuté verzie kódu a dát. Nahrajte nové nastavenia do aktuálneho konfigurátora a odošlite novú požiadavku.

</details>

## Vývoj a nasadenie

Na používanie webu netreba klonovať repozitár ani inštalovať Node.js. Technické podrobnosti sú v anglickej [príručke pre vývojárov](../docs/DEVELOPER.md) a [popise architektúry](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publikuje vetvy, profily zariadení, balíky, závislosti Kconfig a kompatibilitu pre web i zostavovací systém.

## Poďakovanie

Ďakujeme [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [a všetkým autorom balíkov a prispievateľom](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licencia

Projekt sa šíri pod licenciou [GNU GPLv3 alebo novšou](../LICENSE). Autorské práva a kontakty sú v súbore [NOTICE](../NOTICE).
