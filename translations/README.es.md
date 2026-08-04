# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Idioma / Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · Español · [Português (Brasil)](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch (Sie)](README.de.md) · [Français (vous)](README.fr.md) · [Tiếng Việt](README.vi.md)

**Personalización en línea + compilación en la nube** de firmware OpenWrt. Elige el código fuente, la versión y marca los plugins en la página web; GitHub Actions compila automáticamente y obtienes el firmware gratis.

Actualmente, el **360T7 (MT7981)** es el modelo con mantenimiento completo; los más de 200 modelos restantes de la página están abiertos en **modo semilla** (solo se garantiza el nivel de «que arranca», sin verificación en hardware real: úsalos bajo tu propia responsabilidad; el método para ascenderlos al nivel de mantenimiento completo se explica más abajo, en la sección para mantenedores).

⭐ **¡Una estrella (Star) es tu mayor apoyo, y tu Star es mi motivación para seguir actualizando!**

- Página de personalización (sitio principal): <https://wrt.weigefenxiang.cc.cd>
- Página de personalización (copia de respaldo en el blog): <https://www.weigeshare.cc.cd/wrt/>
- Tres líneas de código fuente: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt oficial](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Ramas de versión**: se indexan todas las ramas remotas de ImmortalWrt. OpenWrt incluye `main` y todas las ramas `openwrt-*`, excepto `lede-17.01`, `pcs-standalone-back` y `master`. La página genera una configuración por fuente, rama y perfil de dispositivo, y solo muestra combinaciones que existen realmente en upstream.
- La interfaz está disponible en **11 idiomas** (chino simplificado / chino tradicional / inglés / ruso / español / portugués / japonés / coreano / alemán / francés / vietnamita), sigue automáticamente el idioma del navegador y puede cambiarse manualmente en la esquina superior derecha; si falta una traducción, se recurre automáticamente al inglés

---

## Soy usuario: cómo personalizar el firmware

1. Abre la página y elige **Source → Branch → Target System → Subtarget → Target Profile → plugins**; después escribe un identificador de compilación.
2. Pulsa **Enviar compilación en la nube → Descargar solicitud y abrir GitHub**. Sube únicamente el `build-request.json` recién descargado y pulsa **Create**; no hay que rellenar dispositivo, fuente, versión ni partición. Carga antes en la web cualquier `.config` o `config.buildinfo` existente para identificar el equipo.
3. El bot responderá en el Issue con el enlace de esta compilación; la compilación completa tarda aproximadamente **2~3 horas**.
4. Cuando la compilación termine, el bot lo notificará con otro comentario; abre la página de la compilación y descarga desde **Artifacts**, en la parte inferior:
   - `fecha-nombre-original.img.gz`: cada imagen final se descarga directamente y sin ZIP; la primera instalación suele usar `factory`;
   - `fecha-CONFIG`: configuraciones enviada/efectiva y metadatos;
   - `fecha-BUILD-LOGS`: registros completos y errores, disponibles 14 días;
   - `fecha-OPTIONAL-PACKAGES` / `fecha-FIRMWARE-OTHER`: paquetes M y archivos auxiliares.
5. Si no quieres compilar, elige **Enviar compilación en la nube → Descargar solo .config**. Actions solo ejecuta `make defconfig` cuando el usuario activa **Defconfig**; de lo contrario, la `.config` completa sigue siendo la entrada autoritativa. Las opciones obligatorias se muestran y solo se aplican tras confirmación.
6. La página carga `build-request.json`, `.config` y `config.buildinfo`. La zona horaria ofrece búsqueda en la lista IANA completa de OpenWrt/LuCI con formato uniforme `(UTC±HH:MM) Region/City`, además del tema LuCI, NTP y el espejo opkg.

> 💡 Después de flashear el firmware: accede desde el navegador a **192.168.1.1** (o a la dirección que hayas personalizado en la página de envío), con el usuario **root** y la **contraseña vacía** (establécela inmediatamente en el primer inicio de sesión); solo la fuente Lean LEDE tiene como contraseña inicial `password`.
>
> 💡 En la esquina superior derecha de la página hay un botón de **autodiagnóstico**: con un clic comprueba la accesibilidad de las fuentes de datos (tres niveles: local / jsDelivr / raw), la lógica de generación del .config y la conectividad con GitHub; si algo no carga bien, púlsalo primero para diagnosticar.
>
> 💡 Al marcar un plugin con dependencias (como el asistente de balanceo MWAN3), sus plugins prerrequisito se marcan automáticamente; las dependencias a nivel de kernel o de bibliotecas se completan solas durante la compilación, sin que tengas que preocuparte.
>
> ⚠️ Para descargar los Artifacts debes iniciar sesión en GitHub. El firmware, la configuración y la información de compilación se conservan 30 días; `BUILD-LOGS`, 14 días.
>
> ⚠️ Flashear conlleva riesgos. La variante de **partición grande de 108M** exige que ya tengas instalado el U-Boot «inmortal» (ubootmod); la variante de **partición de fábrica** se flashea directamente sin modificar las particiones, pero tiene poco espacio: si marcas demasiados plugins, la compilación fallará o no cabrán.

### Encontrar tu firmware en Actions

La lista de compilaciones sigue el patrón `Build 定制 · 你的标识 · 源码 版本/变体`; basta con buscar el identificador que escribiste: repositorio → **Actions** → **custom-build**.

## Compilación autónoma con Fork

Si no quieres hacer cola en el repositorio público, o quieres cambiar la configuración predeterminada, puedes hacerlo todo por tu cuenta:

1. Haz clic en **Fork**, en la esquina superior derecha, para copiar este repositorio a tu cuenta;
2. En tu Fork, ve a **Settings → Features y marca Issues**, y luego, en la **página de Actions, pulsa el botón verde para habilitar los workflows**;
3. Vuelve a la página de personalización, en el paso ④ elige **Mi propio Fork** e introduce tu nombre de usuario de GitHub; a partir de entonces, las compilaciones que envíes se ejecutarán con tu propia cuota gratuita;
4. La página descarga `build-request.json` y abre un formulario Issue con un único adjunto obligatorio. Súbelo y envía; Actions usa directamente su `.config` completo y no lo reconstruye desde el base config del repositorio.

## Soy mantenedor: cómo añadir plugins / modificar la configuración

Flujo de datos: `config/<marca>/<modelo>/*.config` se conserva para importar configuraciones antiguas y solicitudes históricas (360T7 tiene actualmente 14 configuraciones de fuente/rama/Profile). Los nuevos parámetros de compilación proceden dinámicamente de `WeiG-OpenWrt-Menuconfig-Catalog`; cada compilación por Issue usa como entrada final el `.config` completo exportado dentro de `build-request.json`.

### Añadir una nueva opción de plugin

1. Confirma que en las cuatro configuraciones base ya existe la línea `# CONFIG_PACKAGE_luci-app-xxx is not set` de ese paquete (si no existe, significa que el paquete no está en los feeds de esa fuente y primero hay que añadir el feed en el script diy y actualizar la configuración base);
2. Añade una entrada al array `plugins` de `tools/plugins-meta.json`: `{ "id": "xxx", "name": "nombre en chino", "group": "grupo", "desc": "descripción de una línea", "size": 2, "hot": false }` (si el nombre del paquete difiere del sufijo `luci-app-` o cambia entre las tres fuentes, añade el campo `pkgs` para mapearlo explícitamente; si tiene plugins prerrequisito a nivel de luci-app, añade `requires: ["id-del-prerrequisito"]` y la página los marcará automáticamente en cadena);
3. Ejecuta `node tools/gen-plugins.mjs`; el script regenerará `site/wrt/data/360t7/plugins.json`, sincronizará las copias de las configuraciones base y, además, avisará de los plugins que «están en la configuración pero sin catalogar»;
4. Haz commit y push. La página no necesita ningún cambio de código: la nueva opción aparece automáticamente.

### Habilitar / añadir un modelo de router

El catálogo de modelos está en `site/wrt/data/devices.json`, organizado por marca; el 360T7 pertenece al nivel de mantenimiento completo y el resto de los modelos está en **modo semilla** (sus sources se generan a partir de una plantilla, comparten la tabla de plugins semilla y solo se garantiza que arrancan). Pasos para ascender un modelo semilla al nivel de mantenimiento completo:

1. Busca el modelo en `devices.json` y completa `sources` según la situación real (para cada fuente: el nombre del archivo config, las ramas de versions, las variantes de variants y los pares de sustitución de particiones);
2. Coloca las configuraciones base de cada fuente en `config/<marca>/<id-del-modelo>/`, con la convención de nombres `<marca>_<modelo>_<fuente>.config` (el repositorio ya ha generado para la mayoría de los modelos una configuración semilla «mínima que arranca», que solo incluye el modelo objetivo + LuCI y puede usarse tal cual o servir de base para añadir más cosas);
3. Ejecuta `node tools/gen-plugins.mjs` (generará un plugins.json propio para cada modelo habilitado);
4. Prueba de humo: ejecuta una compilación en la nube con cada fuente para confirmar que se genera la imagen.

Cero cambios en el código de la página y del workflow; el parámetro `device` se valida contra la lista blanca como de costumbre.

### Estructura de directorios y arquitectura técnica

Consulta [ARCHITECTURE.md](../ARCHITECTURE.md) (bilingüe chino-inglés).

### Seguridad

- Los Issues aceptan 1–3 adjuntos alojados en GitHub y detectan `build-request.json`, `.config` y `config.buildinfo`; se validan campos, listas permitidas, tamaño, firma de destino y opciones obligatorias de la fuente. La configuración completa es la entrada autoritativa por defecto; `make defconfig` solo se ejecuta una vez si Defconfig se activa expresamente, con protección de Target, Profile, arquitectura y paquetes obligatorios.
- El identificador de compilación (tag) se sanea para admitir solo caracteres chinos, letras latinas, números y guiones, y se usa únicamente para nombrar y mostrar el artifact;
- Los permisos del workflow se limitan a `contents: read + issues: write`.

### Convención de mantenimiento multilingüe de la documentación

**Cada vez que se modifique este README (o cualquier md orientado al usuario), es obligatorio actualizar en sincronía la versión del idioma correspondiente en `translations/`**; lo mismo se aplica a la documentación para desarrolladores (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). Es una regla estricta, pensada para evitar que las versiones en los distintos idiomas se desincronicen.

## Agradecimientos

Gracias a todos los proyectos de código abierto y a los autores que han contribuido directa o indirectamente a este proyecto:

- **Código fuente**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Infraestructura**: [GitHub Actions](https://github.com/features/actions) (compilación en la nube) · [Cloudflare Pages](https://pages.cloudflare.com/) (alojamiento del sitio de respaldo)
- **Todos los autores de los <!--plugin-count-->242<!--/plugin-count--> plugins de LuCI**, así como LuCI, Hexo, el tema Butterfly y demás proyectos del ecosistema;
- Y cada usuario que envía un Issue, reporta problemas o deja una estrella (Star).

Este proyecto se limita a orquestar e invocar los proyectos mencionados; los derechos de autor pertenecen a sus respectivos autores.
