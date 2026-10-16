# Wei.G OpenWrt — personalitza el firmware en línia

Tria el dispositiu i els paquets des del navegador, envia la petició a GitHub i deixa que el firmware OpenWrt es compili al núvol.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Adaptat al mòbil · 🌙 Tema clar i fosc · ✅ Diverses variants d’OpenWrt**

**[🌐 Obre el configurador](https://www.weigshare.com/wrt/) · [⬇️ Baixa el firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribucions compatibles:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Idioma:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Més idiomes</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; **Català** &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Vista prèvia de la interfície

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Comença aquí: el firmware en tres passos

**📖 [Guia completa amb imatges](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Tria el codi font, el dispositiu i els paquets

Obre el [**【Configurador en línia】**](https://www.weigshare.com/wrt/). Selecciona **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** i marca els paquets necessaris. Si cal, ajusta **【Advanced menuconfig】**, la zona horària i el tema. També pots prémer **【Carrega una configuració】** per importar `build-request.json`, `.config` o `config.buildinfo`. Revisa les opcions abans de continuar.

### 2. Envia la compilació a GitHub

Primer [**【inicia la sessió a GitHub】**](https://github.com/login). Torna al [**【Configurador】**](https://www.weigshare.com/wrt/) i prem **【Envia la compilació al núvol】** → **【Baixa la petició i obre GitHub】**. Es baixarà un fitxer `*.json` i s’obrirà un formulari d’Issue. Des de l’ordinador, arrossega el JSON al camp de la petició i prem **【Submit new issue】**. El bot respondrà amb l’enllaç a la compilació.

<details>
<summary><strong>Avisos importants (desplega)</strong></summary>

> Pots revisar la configuració amb **【Test】** a la barra flotant de la cantonada inferior dreta. En generar la petició, la comprovació també es fa automàticament.
>
> Si apareixen problemes, aplica les correccions suggerides o tria **【Conserva i continua igualment】**. Això no arregla els errors del codi font original i la compilació pot fallar.
>
> Fes servir el formulari de GitHub Issue que obre automàticament el configurador per conservar les dades emplenades.
>
> Baixar el JSON sense enviar l’Issue **no inicia la compilació**.
>
> No publiquis contrasenyes reals, tokens ni secrets en Issues públics, peticions o registres.

</details>

### 3. Baixa el firmware

Segueix l’enllaç del teu Issue o entra a [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Quan acabi, baixa el firmware des d’**【Artifacts】**. `CONFIG` conté la configuració i `BUILD-LOGS` els registres; **no són imatges per instal·lar al router**. Els fitxers es conserven durant **60 dies**.

## Preguntes freqüents

<details>
<summary>Per què falta espai a RootFS si trio molts paquets?</summary>

Els paquets i les dependències poden superar la mida de la partició RootFS. Si el dispositiu ho permet, ajusta `TARGET_ROOTFS_PARTSIZE` a **【Advanced menuconfig】** → **【Target Images】**, per exemple a 512 o 1024 MiB. Alguns encaminadors físics tenen particions fixes: cal reduir els paquets. Vegeu [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Per què es talla una compilació molt llarga?</summary>

Un Job de GitHub acostuma a tenir un màxim de sis hores. El projecte fixa **350 minuts** i atura l’execució als **335 minuts** per recollir registres. **S’atura, no queda en pausa per reprendre-la**. Les dependències de Node.js o Rust poden allargar el temps.

</details>

<details>
<summary>Com investigo una compilació fallida?</summary>

Baixa `BUILD-LOGS` des d’**【Artifacts】** i obre primer `00-SUMMARY.txt`. Revisa RootFS, el límit de temps i els errors de codi o dependències. Consulta [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) i crea un **Issue nou** després de corregir les opcions.

</details>

<details>
<summary>Puc tornar a executar un Run antic amb opcions noves?</summary>

No. Un Run antic conserva la petició i les versions de codi i dades originals. Carrega els canvis al configurador actual i envia una nova petició.

</details>

## Desenvolupament i desplegament

Per utilitzar el lloc web no cal clonar el repositori ni instal·lar Node.js. Consulta en anglès la [guia per a desenvolupadors](../docs/DEVELOPER.md) i el [document d’arquitectura](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publica les branques d’origen, els perfils de dispositiu, els paquets, les dependències Kconfig i les dades de compatibilitat que comparteixen el web i el compilador.

## Agraïments

Gràcies a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [i a tots els autors de paquets i col·laboradors](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Llicència

Projecte distribuït sota la [GNU GPLv3 o posterior](../LICENSE). Consulta [NOTICE](../NOTICE) per als drets d’autor i les dades de contacte.
