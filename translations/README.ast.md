# Wei.G OpenWrt — personaliza’l firmware en llinia

Escueyi’l to preséu y los paquetes nel navegador, unvia la solicitú per GitHub y dexa que’l firmware OpenWrt se compile na nube.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Afayadizu pal móvil · 🌙 Temes claru y escuru · ✅ Delles variantes d’OpenWrt**

**[🌐 Abrir el configurador](https://www.weigshare.com/wrt/) · [⬇️ Baxar firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Sistemes compatibles:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Llingua:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Más llingües</b></summary>

<div dir="ltr">
**Asturianu** &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Vista previa de la interfaz

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Entama equí: firmware en tres pasos

**📖 [Guía completa con imáxenes](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Escueyi fonte, preséu y paquetes

Abre’l [**【Configurador en llinia】**](https://www.weigshare.com/wrt/) y escueyi **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Marca los paquetes que precises y axusta **【Advanced menuconfig】**, el fusu horariu o’l tema si fai falta. Con **【Cargar configuración】** puedes importar `build-request.json`, `.config` o `config.buildinfo`. Revisa les opciones enantes de siguir.

### 2. Unvia una compilación per GitHub

Primero [**【entra en GitHub】**](https://github.com/login), torna al [**【Configurador】**](https://www.weigshare.com/wrt/) y primi **【Unviar compilación na nube】** → **【Baxar solicitú y abrir GitHub】**. Descárgase un ficheru `*.json` y ábrese un formulariu de GitHub Issue. Nel ordenador arrastra’l JSON al campu de la solicitú y primi **【Submit new issue】**. El bot responderá con un enllaz a la compilación.

<details>
<summary><strong>Avisos importantes (desplegar)</strong></summary>

> Puedes comprobar los axustes y les recomendaciones de compatibilidá con **【Comprobar】** na barra flotante de la esquina inferior drecha. La revisión faise automáticamente al crear la solicitú.
>
> Si hai problemes, aplica la correición propuesta o escueyi **【Caltener y siguir a la fuercia】**. Esto nun igua los fallos del códigu fonte y la compilación pue fallar.
>
> Usa’l formulariu GitHub Issue qu’abre’l configurador pa conservar los datos yá rellenos.
>
> Baxar namás el JSON ensin unviar l’Issue **nun entama la compilación**.
>
> Nun publiques contraseñes reales, tokens nin otros secretos n’Issues públicos o rexistros.

</details>

### 3. Baxa’l firmware

Sigue l’enllaz del Issue o abre [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Cuando remate, baxa’l firmware de **【Artifacts】**. `CONFIG` tien los axustes y `BUILD-LOGS` los rexistros de diagnósticu; **nun son imáxenes pa instalar nel router**. Los ficheros guárdense **60 díes**.

## Entrugues frecuentes

<details>
<summary>¿Por qué falta espaciu en RootFS con munchos paquetes?</summary>

Los paquetes y dependencies pueden superar el tamañu de RootFS. Si’l preséu lo permite, busca `TARGET_ROOTFS_PARTSIZE` en **【Advanced menuconfig】** → **【Target Images】** y pon, por exemplu, 512 o 1024 MiB. En munchos routers los tamaños de flash son fixos; quita paquetes. Mira [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>¿Por qué se para una compilación llarga?</summary>

Un Job nun GitHub-hosted Runner suel tener un máximu de seis hores. Esti proyeutu llenda a **350 minutos** y para la execución a los **335 minutos** pa guardar rexistros. **Párase; nun queda pausada pa reanudar**.

</details>

<details>
<summary>¿Cómo investigo una compilación fallida?</summary>

Baxa `BUILD-LOGS` de **【Artifacts】** y llei primero `00-SUMMARY.txt`. Comprueba RootFS, tiempu, códigu fonte y dependencies. Mira [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Dempués d’igualo unvia **otro Issue**.

</details>

<details>
<summary>¿Puedo repetir un Run vieyu con configuración nueva?</summary>

Non. Un Run vieyu usa la solicitú y versiones de códigu y datos orixinales. Carga los cambeos nel configurador y unvia una solicitú nueva.

</details>

## Desenvolvimientu y despliegue

Pa usar la web nun fai falta clonar el repositoriu nin instalar Node.js. Hai una [guía de desenvolvimientu](../docs/DEVELOPER.md) y una [descripción de l’arquiteutura](ARCHITECTURE/ARCHITECTURE.md) n’inglés.

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) publica les rames fonte, perfiles de preséu, paquetes, dependencies Kconfig y datos de compatibilidá.

## Agradecimientos

Gracies a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [y a los autores de paquetes y persones collaboradores](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Llicencia

Esti proyeutu usa [GNU GPLv3 o posterior](../LICENSE). Derechos d’autor y contautu en [NOTICE](../NOTICE).
