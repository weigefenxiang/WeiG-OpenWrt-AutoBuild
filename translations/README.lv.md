# Wei.G OpenWrt — pielāgojiet aparātprogrammatūru tiešsaistē

Pārlūkā izvēlieties ierīci un pakotnes, iesniedziet pieprasījumu GitHub un ļaujiet mākonī izveidot OpenWrt aparātprogrammatūru.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Piemērots mobilajām ierīcēm · 🌙 Gaišais un tumšais motīvs · ✅ Vairāki OpenWrt paveidi**

**[🌐 Atvērt konfiguratoru](https://www.weigshare.com/wrt/) · [⬇️ Lejupielādēt aparātprogrammatūru](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Atbalstītās sistēmas:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Valoda:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Citas valodas</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; **Latviešu** &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Saskarnes priekšskatījums

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Darba sākšana: trīs soļi līdz aparātprogrammatūrai

**📖 [Pilna ilustrētā pamācība](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Izvēlieties avotu, ierīci un pakotnes

Atveriet [**【Tiešsaistes konfiguratoru】**](https://www.weigshare.com/wrt/) un izvēlieties **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Atzīmējiet vajadzīgās pakotnes un pēc vajadzības pielāgojiet **【Advanced menuconfig】**, laika joslu un motīvu. Ar **【Ielādēt konfigurāciju】** var importēt `build-request.json`, `.config` vai `config.buildinfo`. Pirms turpināšanas pārbaudiet izvēli.

### 2. Iesniedziet būvēšanas pieprasījumu GitHub

Vispirms [**【piesakieties GitHub】**](https://github.com/login), atgriezieties [**【Konfiguratorā】**](https://www.weigshare.com/wrt/) un nospiediet **【Iesniegt mākoņbūvi】** → **【Lejupielādēt pieprasījumu un atvērt GitHub】**. Tiks lejupielādēts `*.json` fails un atvērta GitHub Issue veidlapa. Datorā ievelciet JSON pieprasījuma laukā un nospiediet **【Submit new issue】**. Bots atbildēs ar būvēšanas saiti.

<details>
<summary><strong>Svarīgas piezīmes (izvērst)</strong></summary>

> Ar **【Pārbaudīt】** peldošajā joslā apakšā pa labi var iepriekš pārskatīt konfigurāciju un saderības ieteikumus. Pārbaude notiek automātiski arī pieprasījuma izveides laikā.
>
> Ja atklātas problēmas, piemērojiet ieteikto labojumu vai izvēlieties **【Saglabāt un tomēr turpināt】**. Tas neizlabo augšupstraumes koda kļūdas un būve var neizdoties.
>
> Lietojiet konfiguratora automātiski atvērto GitHub Issue veidlapu, lai nepazaudētu iepriekš aizpildītos datus.
>
> Tikai JSON lejupielādēšana **neuzsāk būvēšanu**; Issue ir jāiesniedz.
>
> Nepublicējiet īstas paroles, piekļuves pilnvaras vai citus noslēpumus publiskos Issues, pieprasījumos vai žurnālos.

</details>

### 3. Lejupielādējiet aparātprogrammatūru

Atveriet saiti savā Issue vai [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Kad būve izdevusies, lejupielādējiet aparātprogrammatūru no **【Artifacts】**. `CONFIG` satur iestatījumus, `BUILD-LOGS` – diagnostikas žurnālus; **tie nav aparātprogrammatūras attēli ierīces pāršūšanai**. Faili pieejami **60 dienas**.

## Biežāk uzdotie jautājumi

<details>
<summary>Kāpēc daudzām pakotnēm nepietiek RootFS vietas?</summary>

Pakotnes un atkarības var pārsniegt RootFS nodalījuma apjomu. Ja ierīce ļauj, meklējiet `TARGET_ROOTFS_PARTSIZE` sadaļā **【Advanced menuconfig】** → **【Target Images】** un mainiet uz 512 vai 1024 MiB, piemēram. Dažiem fiziskiem maršrutētājiem flash nodalījumi ir fiksēti; tad samaziniet pakotņu skaitu. Skatiet [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Kāpēc ilga būvēšana tiek pārtraukta?</summary>

Viena Job GitHub-hosted Runner parastais limits ir sešas stundas. Projekta ierobežojums ir **350 minūtes**, bet izpilde beidzas pēc **335 minūtēm**, lai savāktu žurnālus. Tā ir **apstādināšana, nevis pauze vēlākai atsākšanai**.

</details>

<details>
<summary>Kā noteikt neveiksmīgas būves iemeslu?</summary>

No **【Artifacts】** lejupielādējiet `BUILD-LOGS` un vispirms skatiet `00-SUMMARY.txt`. Pārbaudiet RootFS vietu, laika limitu, koda un atkarību kļūdas. Skatiet [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Pēc labojumiem izveidojiet **jaunu Issue**.

</details>

<details>
<summary>Vai var palaist vecu Run ar jauniem iestatījumiem?</summary>

Nē. Vecs Run izmanto sākotnējo pieprasījumu un tajā fiksētos koda un datu variantus. Ielādējiet jauno konfigurāciju un iesniedziet jaunu pieprasījumu.

</details>

## Izstrāde un izvietošana

Vietnes lietošanai nav jāklonē repozitorijs vai jāinstalē Node.js. Tehniska informācija angliski: [izstrādātāja ceļvedis](../docs/DEVELOPER.md) un [arhitektūras apraksts](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publicē avota atzarus, ierīču profilus, pakotnes, Kconfig atkarības un saderības datus vietnei un būvēšanas sistēmai.

## Pateicības

Paldies [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [un visiem pakotņu autoriem un atbalstītājiem](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licence

Projektam ir [GNU GPLv3 vai jaunāka](../LICENSE) licence. Autortiesības un kontakti: [NOTICE](../NOTICE).
