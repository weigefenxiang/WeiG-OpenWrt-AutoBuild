# Wei.G OpenWrt: personaliza y compila tu firmware

Elige el dispositivo y los paquetes desde el navegador, envía la solicitud por GitHub y deja que la compilación de OpenWrt se realice en la nube.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Adaptado al móvil · 🌙 Temas claro y oscuro · ✅ Compatible con diversas variantes de OpenWrt**

**[🌐 Abrir el configurador](https://www.weigshare.com/wrt/) · [⬇️ Descargar firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribuciones compatibles:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Idioma:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · **Español** · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Más idiomas</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Vista previa de la interfaz

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Interfaz de escritorio de Wei.G OpenWrt" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Interfaz móvil de Wei.G OpenWrt" width="21.30%">
</p>

## Primeros pasos: crea tu firmware en tres pasos

**📖 [Guía ilustrada paso a paso](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Elige el código fuente, el dispositivo y los paquetes

Abre el [**【Configurador en línea】**](https://www.weigshare.com/wrt/) y selecciona **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Después, marca lo que necesites en **【② Seleccionar paquetes】** y ajusta **【Advanced menuconfig】**, la zona horaria o el tema si procede.

¿Ya tienes una configuración? Pulsa **【Cargar configuración】** e importa `build-request.json`, `.config` o `config.buildinfo`. Comprueba la fuente, el dispositivo y los paquetes antes de seguir.

### 2. Envía la solicitud de compilación a GitHub

Primero, [**【inicia sesión en GitHub】**](https://github.com/login). Vuelve al [**【Configurador】**](https://www.weigshare.com/wrt/) y pulsa **【Enviar compilación a la nube】** → **【Descargar solicitud y abrir GitHub】**. Se descargará un archivo `*.json` y se abrirá un formulario de GitHub Issue. En un ordenador, arrastra el JSON al campo de solicitud y pulsa **【Submit new issue】**.

Tras enviar el Issue, el bot responderá con un enlace a la tarea de compilación.

<details>
<summary><strong>Avisos importantes (desplegar)</strong></summary>

> **Consejo:** Puedes revisar posibles errores y sugerencias de compatibilidad con **【Comprobar】**, en la barra flotante de la esquina inferior derecha. Al elegir **【Descargar solicitud y abrir GitHub】** se realiza igualmente la comprobación automática.
>
> Si aparece algún problema, aplica la corrección recomendada o elige **【Conservar y continuar de todos modos】**. Continuar no soluciona errores del código original ni garantiza que la compilación termine correctamente.
>
> Utiliza el formulario de GitHub Issue que abre el configurador para no perder los datos previamente rellenados.
>
> Descargar el JSON sin enviar el Issue **no inicia ninguna compilación**.
>
> No publiques contraseñas reales, tokens ni otros secretos en Issues públicos, solicitudes o registros.

</details>

### 3. Descarga el firmware

Abre el enlace que dejó el bot en tu Issue o busca la tarea en [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Cuando finalice, descarga el firmware desde **【Artifacts】** al final de la página. `CONFIG` contiene la configuración y `BUILD-LOGS` los registros: **ninguno de los dos sirve para flashear el dispositivo**. Las descargas se conservan durante **60 días**.

## Preguntas frecuentes

<details>
<summary>¿Por qué faltan megabytes en RootFS cuando elijo muchos paquetes?</summary>

El tamaño de los paquetes y sus dependencias puede superar la partición RootFS. Si tu dispositivo lo permite, busca `TARGET_ROOTFS_PARTSIZE` en **【Advanced menuconfig】** → **【Target Images】** y ajústalo según tus necesidades, por ejemplo a 512 o 1024 MiB. Muchos routers físicos no permiten modificar esa partición por sus límites de memoria flash; en ese caso elimina paquetes. Consulta [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>¿Por qué se agota el tiempo de compilación?</summary>

Un Job de GitHub-hosted runner suele tener un límite de seis horas. Aquí se establece un máximo de **350 minutos**, con un plazo de ejecución de **335 minutos** para dejar margen a los registros. Cuando se alcanza el plazo, el proceso **se detiene: no queda pausado para reanudarlo**. Las dependencias grandes, como Node.js o Rust, pueden alargarlo.

</details>

<details>
<summary>¿Cómo averiguo por qué ha fallado una compilación?</summary>

Descarga `BUILD-LOGS` desde **【Artifacts】** y comienza por `00-SUMMARY.txt`. Comprueba si la causa es el tamaño de RootFS, el tiempo de ejecución, el código fuente o alguna dependencia. Tienes ejemplos en [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Corrige la configuración y crea **un Issue nuevo**.

</details>

<details>
<summary>¿Puedo volver a ejecutar un Run antiguo después de cambiar la configuración?</summary>

No para probar los cambios. Un Run antiguo conserva su solicitud y las versiones de código y datos originales. Recarga la configuración en el sitio, compruébala y envía un nuevo Issue.

</details>

## Desarrollo y despliegue

Para utilizar la web no hace falta clonar el repositorio ni instalar Node.js. Si desarrollas o despliegas el proyecto, consulta la [guía para desarrolladores (en inglés)](../docs/DEVELOPER.md) y la [documentación de arquitectura (en inglés)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) recopila y publica las ramas de código, perfiles de dispositivos, paquetes, dependencias Kconfig y datos de compatibilidad. El configurador y la compilación consumen esa misma información, sin mantener otra base de dispositivos y paquetes en AutoBuild.

## Agradecimientos

Gracias a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) y a [todos los autores de paquetes y colaboradores](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licencia

Este proyecto se distribuye bajo la licencia [GNU GPLv3](../LICENSE) o posterior. Los derechos de autor y los datos de contacto figuran en [NOTICE](../NOTICE).
