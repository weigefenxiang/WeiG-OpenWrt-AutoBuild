# Wei.G OpenWrt — saincheap do firmware ar líne

Roghnaigh do ghléas agus na pacáistí sa bhrabhsálaí, seol iarratas trí GitHub agus lig don tseirbhís scamall firmware OpenWrt a thiomsú.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Oiriúnach do ghutháin · 🌙 Téama geal agus dorcha · ✅ Leaganacha éagsúla de OpenWrt**

**[🌐 Oscail an cumraitheoir](https://www.weigshare.com/wrt/) · [⬇️ Íoslódáil firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Córais a dtacaítear leo:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Teanga:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Tuilleadh teangacha</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; **Gaeilge** &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Réamhamharc ar an gcomhéadan

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Tús tapa: firmware i dtrí chéim

**📖 [Treoir iomlán le pictiúir](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Roghnaigh foinse, gléas agus pacáistí

Oscail an [**【Cumraitheoir ar líne】**](https://www.weigshare.com/wrt/) agus roghnaigh **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Roghnaigh na pacáistí atá uait agus athraigh **【Advanced menuconfig】**, an crios ama agus an téama más gá. Le **【Luchtaigh cumraíocht】** is féidir `build-request.json`, `.config` nó `config.buildinfo` a iompórtáil. Seiceáil na socruithe roimh leanúint ar aghaidh.

### 2. Seol iarratas tógála ar GitHub

[**【Sínigh isteach ar GitHub】**](https://github.com/login) ar dtús, ansin fill ar an [**【gCumraitheoir】**](https://www.weigshare.com/wrt/) agus roghnaigh **【Seol tógáil scamall】** → **【Íoslódáil iarratas agus oscail GitHub】**. Íoslódálfar comhad `*.json` agus osclófar foirm GitHub Issue. Ar ríomhaire, tarraing an JSON isteach sa réimse iarratais agus cliceáil **【Submit new issue】**. Freagróidh an bot le nasc chuig an tógáil.

<details>
<summary><strong>Nótaí tábhachtacha (leathnaigh)</strong></summary>

> Is féidir socruithe agus moltaí comhoiriúnachta a sheiceáil roimh ré le **【Tástáil】** ar an mbarra ar snámh ag bun na láimhe deise. Ritheann an tseiceáil go huathoibríoch nuair a chruthaítear an t-iarratas.
>
> Má aimsítear fadhb, glac leis an réiteach molta nó roghnaigh **【Coinnigh agus lean ar aghaidh ar aon nós】**. Ní cheartaíonn sé seo fabhtanna sa chód foinse agus d’fhéadfadh an tógáil teip.
>
> Úsáid an fhoirm GitHub Issue a d’oscail an cumraitheoir chun na sonraí réamhlíonta a chaomhnú.
>
> Ní thosaíonn íoslódáil an JSON amháin **an tógáil**; caithfear an Issue a sheoladh.
>
> Ná roinn fíorphasfhocail, comharthaí rochtana ná rúin eile in Issues phoiblí nó i logaí.

</details>

### 3. Íoslódáil an firmware

Lean an nasc san Issue nó oscail [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Nuair a éiríonn leis, íoslódáil firmware ó **【Artifacts】**. Tá cumraíocht i `CONFIG` agus logaí diagnóise i `BUILD-LOGS`; **ní híomhánna firmware iad atá le splancadh**. Fanann na comhaid ar fáil ar feadh **60 lá**.

## Ceisteanna coitianta

<details>
<summary>Cén fáth a n-éiríonn RootFS lán le go leor pacáistí?</summary>

D’fhéadfadh pacáistí agus a spleáchais dul thar mhéid na deighilte RootFS. Má cheadaíonn an gléas é, aimsigh `TARGET_ROOTFS_PARTSIZE` faoi **【Advanced menuconfig】** → **【Target Images】** agus socraigh, mar shampla, 512 nó 1024 MiB. Tá deighiltí cuimhne seasta ag roinnt ródairí; bain pacáistí nach gá. Féach [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Cén fáth a stopann tógáil fhada?</summary>

Is é sé huaire an teorainn ghnách ar Job i GitHub-hosted Runner. Tá teorainn **350 nóiméad** sa tionscadal seo agus stopann an próiseas tar éis **335 nóiméad** chun logaí a bhailiú. Is **stopadh é, ní sos is féidir a atosú**.

</details>

<details>
<summary>Conas is féidir teip tógála a fhiosrú?</summary>

Íoslódáil `BUILD-LOGS` ó **【Artifacts】** agus léigh `00-SUMMARY.txt` ar dtús. Seiceáil spás RootFS, an teorainn ama, cód foinse agus spleáchais. Féach [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Cruthaigh **Issue nua** tar éis athruithe.

</details>

<details>
<summary>An féidir Run sean a athrith le socruithe nua?</summary>

Ní féidir. Úsáideann Run sean an t-iarratas, an cód agus na sonraí a socraíodh ar dtús. Luchtaigh na socruithe nua agus seol iarratas úr.

</details>

## Forbairt agus imscaradh

Ní gá an stór a chlónáil ná Node.js a shuiteáil chun an suíomh a úsáid. Tá [treoir an fhorbróra](../docs/DEVELOPER.md) agus [doiciméad na hailtireachta](ARCHITECTURE/ARCHITECTURE.md) ar fáil i mBéarla.

## Menuconfig Catalog

Foilsíonn [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) brainsí foinse, próifílí gléasanna, pacáistí, spleáchais Kconfig agus sonraí comhoiriúnachta don suíomh agus don chóras tógála.

## Buíochas

Gabhaimid buíochas le [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [agus le gach údar pacáiste agus rannpháirtí](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Ceadúnas

Tá an tionscadal faoi [GNU GPLv3 nó níos déanaí](../LICENSE). Tá cóipcheart agus sonraí teagmhála i [NOTICE](../NOTICE).
