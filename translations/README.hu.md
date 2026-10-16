# Wei.G OpenWrt – egyedi firmware online

Válaszd ki az eszközt és a csomagokat a böngészőben, küldd el a kérést GitHubon, és hagyd a felhőre az OpenWrt firmware fordítását.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Mobilbarát · 🌙 Világos és sötét téma · ✅ Több OpenWrt-alapú rendszer**

**[🌐 Konfigurátor megnyitása](https://www.weigshare.com/wrt/) · [⬇️ Firmware letöltése](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Támogatott rendszerek:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Nyelv:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 További nyelvek</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; **Magyar** &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Felület előnézete

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Első lépések: firmware három lépésben

**📖 [Részletes képes útmutató](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Forrás, eszköz és csomagok kiválasztása

Nyisd meg az [**【Online konfigurátort】**](https://www.weigshare.com/wrt/), majd válaszd ki a **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** értékeit. Jelöld be a szükséges csomagokat, és szükség esetén módosítsd az **【Advanced menuconfig】**, az időzóna és a téma beállításait. Meglévő konfigurációt a **【Konfiguráció betöltése】** opcióval, `build-request.json`, `.config` vagy `config.buildinfo` fájlból importálhatsz. Folytatás előtt ellenőrizd a választást.

### 2. Felhőben történő fordítás kérése GitHubon

Először [**【jelentkezz be a GitHubra】**](https://github.com/login), majd térj vissza a [**【Konfigurátorhoz】**](https://www.weigshare.com/wrt/). Kattints a **【Felhőfordítás beküldése】** → **【Kérés letöltése és GitHub megnyitása】** gombokra. A böngésző letölt egy `*.json` fájlt és megnyitja a GitHub Issue űrlapot. Asztali gépen húzd a fájlt a megfelelő mezőbe, majd válaszd a **【Submit new issue】** lehetőséget. A bot a fordítás hivatkozásával válaszol.

<details>
<summary><strong>Fontos tudnivalók (megnyitás)</strong></summary>

> A jobb alsó sarokban lebegő eszköztár **【Teszt】** gombjával előre ellenőrizheted a konfigurációt és a kompatibilitási tanácsokat. A kérés létrehozásakor az ellenőrzés automatikusan is lefut.
>
> Hiba esetén elfogadhatod a javasolt javítást, vagy választhatod a **【Megtartás és kényszerített folytatás】** lehetőséget. Ez nem javítja ki a forráskód hibáit, így a fordítás meghiúsulhat.
>
> A konfigurátor által automatikusan megnyitott GitHub Issue űrlapot használd, hogy az előre kitöltött adatok megmaradjanak.
>
> A JSON fájl puszta letöltése **nem indítja el a fordítást**; az Issue-t is el kell küldeni.
>
> Ne közölj valódi jelszavakat, tokeneket és más titkokat nyilvános Issue-ban vagy naplóban.

</details>

### 3. Firmware letöltése

Kövesd az Issue-ban kapott linket, vagy nyisd meg az [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) oldalt. Sikeres futás után az **【Artifacts】** résznél töltsd le a firmware-t. A `CONFIG` beállításokat, a `BUILD-LOGS` diagnosztikai naplókat tartalmaz; **egyik sem telepíthető firmware-képfájl**. A fájlok **60 napig** maradnak elérhetők.

## Gyakori kérdések

<details>
<summary>Miért fogy el a RootFS helye sok csomag esetén?</summary>

A csomagok és függőségeik túlléphetik a RootFS partíció méretét. Ha az eszköz engedi, a **【Advanced menuconfig】** → **【Target Images】** alatt állítsd a `TARGET_ROOTFS_PARTSIZE` értékét például 512 vagy 1024 MiB-ra. Sok fizikai útválasztó flash-partíciója nem növelhető; ott csökkentsd a csomagok számát. Példák: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Miért áll le egy túl hosszú build?</summary>

Egy GitHubon futó Job szokásos korlátja hat óra. Itt **350 perc** a limit, de a végrehajtás **335 perc** után leáll a naplók begyűjtése miatt. **Leáll, nem később folytatható szünetet tart**.

</details>

<details>
<summary>Hogyan deríthetem ki a sikertelen fordítás okát?</summary>

Töltsd le a `BUILD-LOGS` fájlt az **【Artifacts】** részből, és először olvasd el a `00-SUMMARY.txt` állományt. Ellenőrizd a RootFS-t, az időkorlátot, a forrás- és függőségi hibákat. Lásd [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Javítás után küldj be **új Issue-t**.

</details>

<details>
<summary>Futtatható a régi Run az új beállításokkal?</summary>

Nem. A régi Run a korábban rögzített kérést, kódot és adatokat használja. Az aktuális konfigurátorban ellenőrizd újra a beállításokat és küldj új kérést.

</details>

## Fejlesztés és telepítés

A webes fordításhoz nem kell klónozni a repót vagy Node.js-t telepíteni. Technikai részletek az angol [fejlesztői útmutatóban](../docs/DEVELOPER.md) és az [architektúra leírásában](ARCHITECTURE/ARCHITECTURE.md) találhatók.

## Menuconfig Catalog

A [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) a forráságakat, eszközprofilokat, csomagokat, Kconfig-függőségeket és kompatibilitási adatokat teszi közzé a web és a build-rendszer számára.

## Köszönetnyilvánítás

Köszönet [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [valamint minden csomagkészítőnek és közreműködőnek](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licenc

A projekt a [GNU GPLv3 vagy újabb](../LICENSE) licenc szerint használható. A szerzői jogi és kapcsolattartási adatok a [NOTICE](../NOTICE) fájlban olvashatók.
