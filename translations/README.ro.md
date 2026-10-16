# Wei.G OpenWrt — personalizează firmware-ul online

Alege dispozitivul și pachetele în browser, trimite cererea pe GitHub și lasă serviciul cloud să compileze firmware-ul OpenWrt.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Adaptat pentru telefon · 🌙 Temă deschisă și întunecată · ✅ Mai multe distribuții bazate pe OpenWrt**

**[🌐 Deschide configuratorul](https://www.weigshare.com/wrt/) · [⬇️ Descarcă firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribuții acceptate:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Limbă:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Mai multe limbi</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; **Română** &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Previzualizarea interfeței

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Începe aici: firmware în trei pași

**📖 [Ghid complet ilustrat](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Alege sursa, dispozitivul și pachetele

Deschide [**【Configuratorul online】**](https://www.weigshare.com/wrt/) și selectează **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Bifează pachetele dorite și ajustează **【Advanced menuconfig】**, fusul orar și tema dacă este necesar. Cu **【Încarcă o configurație】** poți importa `build-request.json`, `.config` sau `config.buildinfo`. Verifică setările înainte de a continua.

### 2. Trimite cererea de compilare pe GitHub

Mai întâi [**【autentifică-te pe GitHub】**](https://github.com/login). Revino la [**【Configurator】**](https://www.weigshare.com/wrt/) și apasă **【Trimite compilarea în cloud】** → **【Descarcă cererea și deschide GitHub】**. Browserul descarcă fișierul `*.json` și deschide formularul GitHub Issue. Pe calculator, trage JSON-ul în câmpul cererii și apasă **【Submit new issue】**. Botul răspunde cu un link către compilare.

<details>
<summary><strong>Informații importante (extinde)</strong></summary>

> Poți verifica din timp configurația și recomandările de compatibilitate cu **【Test】** din bara flotantă din dreapta jos. Verificarea rulează automat și la generarea cererii.
>
> Dacă se găsește o problemă, aplică remedierea recomandată sau alege **【Păstrează și continuă forțat】**. Continuarea forțată nu repară erorile din codul sursă și nu garantează o compilare reușită.
>
> Folosește pagina GitHub Issue deschisă automat de configurator pentru a păstra informațiile precompletate.
>
> Descărcarea JSON-ului fără trimiterea Issue-ului **nu pornește compilarea**.
>
> Nu publica parole reale, tokenuri sau alte date confidențiale în Issue-uri publice, cereri ori jurnale.

</details>

### 3. Descarcă firmware-ul

Urmează linkul din Issue sau găsește rularea în [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). După finalizare, descarcă firmware-ul din **【Artifacts】**, la baza paginii. `CONFIG` conține setările, iar `BUILD-LOGS` jurnalele de diagnosticare — **niciunul nu este o imagine firmware pentru instalare**. Fișierele sunt păstrate **60 de zile**.

## Întrebări frecvente

<details>
<summary>De ce rămâne RootFS fără spațiu când aleg multe pachete?</summary>

Pachetele și dependențele pot depăși dimensiunea partiției RootFS. Dacă dispozitivul permite, caută `TARGET_ROOTFS_PARTSIZE` în **【Advanced menuconfig】** → **【Target Images】** și ajustează la 512 sau 1024 MiB, după caz. Unele routere fizice au partiții flash fixe; pentru acestea elimină pachetele inutile. Exemple: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>De ce se oprește o compilare prea lungă?</summary>

Un Job pe un GitHub-hosted Runner are de obicei limita de șase ore. Proiectul folosește **350 de minute** pentru Job și oprește execuția după **335 de minute** pentru a lăsa timp jurnalelor. Compilarea **se încheie; nu rămâne în pauză pentru reluare**. Dependențe mari, precum Node.js și Rust, pot prelungi durata.

</details>

<details>
<summary>Cum investighez o compilare eșuată?</summary>

Descarcă `BUILD-LOGS` din **【Artifacts】** și citește mai întâi `00-SUMMARY.txt`. Verifică spațiul RootFS, limitele de timp și erorile de sursă sau dependențe. Consultă [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). După modificări, creează **un Issue nou**.

</details>

<details>
<summary>Pot relansa un Run vechi după modificarea configurației?</summary>

Nu pentru a testa noile setări. Run-ul vechi folosește cererea originală și versiunile de cod și date fixate atunci. Încarcă setările noi și trimite o cerere nouă.

</details>

## Dezvoltare și implementare

Utilizatorii obișnuiți nu trebuie să cloneze depozitul ori să instaleze Node.js. Informațiile tehnice se găsesc în engleză în [ghidul dezvoltatorului](../docs/DEVELOPER.md) și [documentul de arhitectură](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publică ramuri de cod, profiluri de dispozitive, pachete, dependențe Kconfig și date de compatibilitate. Site-ul și procesul de compilare folosesc aceeași sursă de date, fără o a doua bază de dispozitive și pachete în AutoBuild.

## Mulțumiri

Mulțumim [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [precum și autorilor de pachete și tuturor colaboratorilor](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licență

Proiectul este licențiat sub [GNU GPLv3 sau o versiune ulterioară](../LICENSE). Detaliile privind drepturile de autor și contactul sunt în [NOTICE](../NOTICE).
