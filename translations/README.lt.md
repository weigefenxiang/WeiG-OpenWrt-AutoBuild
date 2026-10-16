# Wei.G OpenWrt – pritaikykite programinę-aparatinę įrangą internetu

Naršyklėje pasirinkite įrenginį ir paketus, pateikite užklausą per GitHub, o OpenWrt programinę-aparatinę įrangą sukompiliuos debesijos paslauga.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Pritaikyta telefonams · 🌙 Šviesi ir tamsi tema · ✅ Kelios OpenWrt pagrindu sukurtos sistemos**

**[🌐 Atverti konfigūratorių](https://www.weigshare.com/wrt/) · [⬇️ Atsisiųsti programinę įrangą](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Palaikomos sistemos:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Kalba:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Kitos kalbos</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; **Lietuvių** &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Sąsajos peržiūra

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Pradžia: programinė įranga trimis žingsniais

**📖 [Išsamus vadovas su iliustracijomis](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Pasirinkite šaltinį, įrenginį ir paketus

Atverkite [**【Internetinį konfigūratorių】**](https://www.weigshare.com/wrt/) ir rinkitės **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Pažymėkite reikalingus paketus, prireikus pakeiskite **【Advanced menuconfig】**, laiko juostą ir temą. Naudodami **【Įkelti konfigūraciją】** galite importuoti `build-request.json`, `.config` ar `config.buildinfo`. Prieš tęsdami patikrinkite nustatymus.

### 2. Pateikite debesijos kompiliavimo užklausą

Pirmiausia [**【prisijunkite prie GitHub】**](https://github.com/login), grįžkite į [**【Konfigūratorių】**](https://www.weigshare.com/wrt/) ir spauskite **【Pateikti debesijos kompiliavimą】** → **【Atsisiųsti užklausą ir atverti GitHub】**. Naršyklė atsisiųs `*.json` ir atvers GitHub Issue formą. Kompiuteryje nutempkite JSON į užklausos lauką, tada spauskite **【Submit new issue】**. Robotas atsakys pateikdamas kompiliavimo nuorodą.

<details>
<summary><strong>Svarbi informacija (išskleisti)</strong></summary>

> Apatiniame dešiniajame kampe esančioje slankiojoje juostoje **【Patikra】** leidžia iš anksto tikrinti konfigūraciją ir suderinamumą. Kuriant užklausą patikra atliekama automatiškai.
>
> Nustačius problemą, pritaikykite siūlomą pataisą arba rinkitės **【Palikti ir vis tiek tęsti】**. Tai neištaiso pirminio kodo klaidų, todėl kompiliavimas gali nepavykti.
>
> Naudokite konfigūratoriaus automatiškai atvertą GitHub Issue formą, kad neliktų prarastų iš anksto įrašytų duomenų.
>
> Vien JSON atsisiuntimas **nepradeda kompiliavimo**. Būtina pateikti Issue.
>
> Neskelbkite tikrų slaptažodžių, žetonų ar kitos konfidencialios informacijos viešuose Issues, užklausose ar žurnaluose.

</details>

### 3. Atsisiųskite programinę įrangą

Sekite Issue nuorodą arba atverkite [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Sėkmingai užbaigus atsisiųskite įrenginio programinę įrangą iš **【Artifacts】**. `CONFIG` yra nustatymai, o `BUILD-LOGS` – diagnostikos žurnalai, **ne įrenginyje įrašomi vaizdai**. Failai saugomi **60 dienų**.

## Dažniausiai užduodami klausimai

<details>
<summary>Kodėl pritrūksta RootFS vietos pasirinkus daug paketų?</summary>

Paketai ir priklausomybės gali viršyti RootFS skaidinio dydį. Jei įrenginys leidžia, **【Advanced menuconfig】** → **【Target Images】** rasite `TARGET_ROOTFS_PARTSIZE`; galima nustatyti, pavyzdžiui, 512 arba 1024 MiB. Kai kurių maršrutizatorių „flash“ skaidiniai nekeičiami – sumažinkite paketų skaičių. Pavyzdžiai: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Kodėl ilgai trunkantis kompiliavimas sustoja?</summary>

Vieno Job GitHub-hosted Runner įprasta riba – šešios valandos. Projekte nustatyta **350 minučių** riba, o vykdymas stabdomas po **335 minučių**, kad būtų laiko žurnalams. **Tai sustabdymas, o ne pauzė, kurią galima pratęsti**.

</details>

<details>
<summary>Kaip tirti nesėkmingą kompiliavimą?</summary>

Iš **【Artifacts】** atsisiųskite `BUILD-LOGS`, pirmiausia skaitykite `00-SUMMARY.txt`. Tikrinkite RootFS vietą, laiko limitą ir kodo ar priklausomybių klaidas. Plačiau: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Pataisę sukurkite **naują Issue**.

</details>

<details>
<summary>Ar galima seną Run paleisti iš naujo su naujais nustatymais?</summary>

Ne. Senas Run naudoja pradinę užklausą ir anksčiau užfiksuotus kodo bei duomenų variantus. Patikrinkite naują konfigūraciją ir pateikite naują užklausą.

</details>

## Kūrimas ir diegimas

Naudojantis svetaine nereikia klonuoti saugyklos ar diegti Node.js. Techninė informacija anglų kalba: [kūrėjo vadovas](../docs/DEVELOPER.md) ir [architektūros aprašas](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) skelbia šaltinių šakas, įrenginių profilius, paketus, Kconfig priklausomybes ir suderinamumo duomenis svetainei bei kompiliavimo sistemai.

## Padėkos

Dėkojame [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [ir visiems paketų kūrėjams bei prisidėjusiems](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licencija

Projektui taikoma [GNU GPLv3 arba vėlesnė](../LICENSE) licencija. Autorių teisės ir kontaktai nurodyti [NOTICE](../NOTICE).
