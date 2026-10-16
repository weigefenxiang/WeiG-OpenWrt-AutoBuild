# Wei.G OpenWrt — Beet a firmware ti' Internet

Ti' navegador je'el a páajtal a yéeyik a dispositivo yéetel le paquetes. Ka túuxt a solicitud ti' GitHub, le cloud ku beetik OpenWrt firmware.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Ku meyaj ti' celular · 🌙 Sáasil yéetel éek'joch'e'en tema · ✅ Ya'ab u jejeláasil OpenWrt**

**[🌐 Je'ele' le configurador](https://www.weigshare.com/wrt/) · [⬇️ Ch'a' le firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Sistemas ku páajtal u meyaj:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**T'aan:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Uláak' t'aano'ob</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; **Màaya t'aan** &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Il bix u yila'al le interfaz

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Káajal: óoxp'éel páajtalil ti' firmware

**📖 [Guía yéetel oochelo'ob](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Yéey u fuente, dispositivo yéetel paquetes

Je'el le [**【Configurador online】**](https://www.weigshare.com/wrt/). Yéey **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Yéey le paquetes ka k'áatik; ka k'ex **【Advanced menuconfig】**, zona horaria yéetel tema wa k'áabet. Yéetel **【Cargar configuración】** je'el a páajtal a t'áalik `build-request.json`, `.config` wa `config.buildinfo`. Il a configuración ma'ili' a bin táanil.

### 2. Túuxt solicitud ti' GitHub

Yáax [**【Ookol ti' GitHub】**](https://github.com/login), ka suut ti' [**【Configurador】**](https://www.weigshare.com/wrt/). T'aak **【Enviar compilación cloud】** → **【Bajar solicitud y abrir GitHub】**. Le navegador ku ch'a'ik `*.json` yéetel ku je'ik GitHub Issue. Ti' computadora, ts'aaj le JSON ichil le campo solicitud, ka t'aak **【Submit new issue】**. Le bot ku núukik yéetel enlace ti' le build.

<details>
<summary><strong>T'aanilo'ob k'áabet (je'ele')</strong></summary>

> Ti' xno'oj ka'an u ts'ookil página yan **【Test】** ichil le barra flotante. Yéetel leti' je'el a páajtal a ilik le problemas configuración yéetel compatibilidad; le solicitud ku beetik revisión automática.
>
> Wa yan problema, meyaj yéetel le corrección ku ya'ala'al, wa yéey **【Conservar y seguir a fuerza】**. Le je'ela' ma' ku ki'iki' le errores ti' código fuente; le build je'el u páajtal u lúubul.
>
> Meyaj yéetel le GitHub Issue página ku je'ik le configurador, tumen leti' ku kanáantik le datos yaan ts'íibta'an.
>
> Ch'a'ik JSON chéen ma' ku káajsik le build. K'áabet a túuxtik le Issue.
>
> Ma' a ts'íibtik contraseñas jaaj, tokens wa secretos ti' Issues públicos, solicitudes yéetel logs.

</details>

### 3. Ch'a' le firmware

Il le enlace ti' a Issue wa je'el [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Wa ts'o'ok u beetik, ch'a' le firmware ti' **【Artifacts】**. `CONFIG` yan configuración yéetel `BUILD-LOGS` yan registros; ma' firmware imágenes utia'al flash. Le archivos ku p'áatal **60 k'iino'ob**.

## K'áat chi'ob ku beetik ya'ab

<details>
<summary>Ba'ax o'olal ma' sáamal u lugaril RootFS wa ya'ab paquetes?</summary>

Le paquetes yéetel dependencias je'el u páajtal u máan u tamaño RootFS. Wa le dispositivo ku cha'ik, il `TARGET_ROOTFS_PARTSIZE` ti' **【Advanced menuconfig】** → **【Target Images】**; je'el a páajtal a ts'áik 512 wa 1024 MiB. Ya'an routers físicos ma' u páajtal u k'exik partición flash; ya'abile' p'íit paquetes. Il [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Ba'ax o'olal ku p'atik u meyaj le build wa ya'ab k'iin?</summary>

GitHub-hosted Runner ku cha'ik le Job u meyaj tak seis horas. Le proyecto yan límite **350 minutos** yéetel ejecución ku ts'o'okol ti' **335 minutos** utia'al guardar logs. Ku ts'o'okol, ma' ku p'áatal en pausa utia'al suut u meyaj.

</details>

<details>
<summary>Bix je'el u páajtal in ilik ba'ax o'olal ma' máan le build?</summary>

Ch'a' `BUILD-LOGS` ti' **【Artifacts】**. Yáax xok `00-SUMMARY.txt`; ka il RootFS, límite tiempo yéetel errores código wa dependencias. Il [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Wa ts'o'ok a k'exik, túuxt **uláak' Issue**.

</details>

<details>
<summary>Je'el in páajtal in beetik Run úuchben yéetel configuración túumben?</summary>

Ma'. Le Run úuchben ku meyaj yéetel solicitud, código yéetel datos úuchben. Il a configuración túumben, ka túuxt solicitud túumben.

</details>

## Desarrollo yéetel despliegue

Utia'al meyaj yéetel le web ma' k'áabet a clonar repositorio ni instalar Node.js. Ya'an u [guía desarrollador](../docs/DEVELOPER.md) yéetel u [documento arquitectura](ARCHITECTURE/ARCHITECTURE.md) ich inglés.

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) ku ts'áik datos ti' ramas fuente, perfiles dispositivo, paquetes, dependencias Kconfig yéetel compatibilidad utia'al web yéetel build.

## Yuum bo'otik

Yuum bo'otik ti' [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [yéetel tuláakal autores paquetes yéetel ayudantes](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licencia

Le proyecto yan [GNU GPLv3 wa uláak' túumben](../LICENSE). Il derechos yéetel contacto ti' [NOTICE](../NOTICE).
