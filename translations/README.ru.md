# Wei.G OpenWrt — сборка прошивок онлайн

Выберите устройство и нужные пакеты на сайте, отправьте запрос через GitHub, а компиляцию прошивки OpenWrt выполнит облачная сборка.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Удобно на телефоне · 🌙 Светлая и тёмная темы · ✅ Несколько веток OpenWrt и производных**

**[🌐 Открыть конфигуратор](https://www.weigshare.com/wrt/) · [⬇️ Скачать прошивку](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Поддерживаются:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Язык:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · **Русский** · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Другие языки</b></summary>

<div dir="ltr">
Asturianu &lrm;·&lrm; Azərbaycanca &lrm;·&lrm; Беларуская &lrm;·&lrm; Български &lrm;·&lrm; বাংলা &lrm;·&lrm; বাংলা (বাংলাদেশ) &lrm;·&lrm; Català &lrm;·&lrm; Čeština &lrm;·&lrm; Dansk &lrm;·&lrm; Ελληνικά &lrm;·&lrm; Suomi &lrm;·&lrm; Filipino &lrm;·&lrm; Gaeilge &lrm;·&lrm; हिन्दी &lrm;·&lrm; Magyar &lrm;·&lrm; Bahasa Indonesia &lrm;·&lrm; Italiano &lrm;·&lrm; ქართული &lrm;·&lrm; ລາວ &lrm;·&lrm; Lietuvių &lrm;·&lrm; Latviešu &lrm;·&lrm; മലയാളം &lrm;·&lrm; मराठी &lrm;·&lrm; Bahasa Melayu &lrm;·&lrm; Norsk bokmål &lrm;·&lrm; Nederlands &lrm;·&lrm; Polski &lrm;·&lrm; Português (Brasil) &lrm;·&lrm; Română &lrm;·&lrm; Slovenčina &lrm;·&lrm; Svenska &lrm;·&lrm; தமிழ் &lrm;·&lrm; Türkçe &lrm;·&lrm; Українська &lrm;·&lrm; Màaya t'aan &lrm;·&lrm; &#x2067;العربية&#x2069; &lrm;·&lrm; &#x2067;فارسی&#x2069; &lrm;·&lrm; &#x2067;עברית&#x2069; &lrm;·&lrm; &#x2067;اردو&#x2069;
</div>

</details>

## Как выглядит интерфейс

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Интерфейс Wei.G OpenWrt для компьютера" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Интерфейс Wei.G OpenWrt для телефона" width="21.30%">
</p>

## Быстрый старт: три шага до готовой прошивки

**📖 [Подробная инструкция с иллюстрациями](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Выберите исходники, устройство и пакеты

Откройте [**【Конфигуратор】**](https://www.weigshare.com/wrt/). Последовательно выберите **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. В разделе **【② Пакеты】** отметьте нужные компоненты; при необходимости настройте **【Advanced menuconfig】**, часовой пояс и тему.

Если конфигурация уже есть, нажмите **【Загрузить конфигурацию】** и импортируйте `build-request.json`, `.config` или `config.buildinfo`. Перед продолжением проверьте ветку, модель и пакеты.

### 2. Отправьте запрос на облачную сборку

Сначала [**【войдите в GitHub】**](https://github.com/login), затем вернитесь в [**【Конфигуратор】**](https://www.weigshare.com/wrt/) и выберите **【Отправить на облачную сборку】** → **【Скачать запрос и открыть GitHub】**. Сайт скачает файл `*.json` и откроет форму GitHub Issue. На компьютере перетащите JSON в поле запроса и нажмите **【Submit new issue】**.

После отправки Issue бот ответит ссылкой на запуск сборки.

<details>
<summary><strong>Важные замечания (развернуть)</strong></summary>

> **Совет:** Проверку настроек и рекомендации по совместимости можно заранее запустить кнопкой **【Тест】** на плавающей панели в правом нижнем углу. При выборе **【Скачать запрос и открыть GitHub】** проверки запускаются автоматически.
>
> Если обнаружены проблемы, примените предложенное исправление или выберите **【Сохранить и продолжить принудительно】**. Принудительное продолжение не устраняет ошибки в исходниках и не гарантирует успешную сборку.
>
> Отправляйте запрос через страницу GitHub Issue, автоматически открытую конфигуратором: она содержит заранее заполненные данные.
>
> Простое скачивание JSON без отправки Issue **не запускает сборку**.
>
> Не публикуйте реальные пароли, токены и другие секреты в общедоступных Issues, запросах и журналах.

</details>

### 3. Скачайте прошивку

Перейдите по ссылке из Issue или найдите запуск в [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). После успешной сборки прошивка появится внизу страницы в разделе **【Artifacts】**. `CONFIG` содержит настройки, а `BUILD-LOGS` — журналы; **прошивать ими устройство нельзя**. Файлы доступны **60 дней**.

## Частые вопросы

<details>
<summary>Почему при большом числе пакетов не хватает места в RootFS?</summary>

Прошивка вместе с зависимостями может не поместиться в корневой раздел. Если платформа позволяет, откройте **【Advanced menuconfig】** → **【Target Images】** и найдите `TARGET_ROOTFS_PARTSIZE`: в некоторых случаях помогает 512 или 1024 MiB. На аппаратных роутерах изменить раздел часто невозможно из-за объёма флеш-памяти или схемы разделов — тогда уберите лишние пакеты. Примеры: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Почему сборка прерывается по времени?</summary>

На GitHub-hosted runner один Job обычно ограничен шестью часами. Здесь Job ограничен **350 минутами**, а компиляция останавливается к **335-й минуте**, чтобы сохранить время для журналов. Это **остановка, не пауза**: продолжить сборку с того же места нельзя. Большие зависимости, например Node.js и Rust, увеличивают время работы.

</details>

<details>
<summary>Что делать, если сборка завершилась ошибкой?</summary>

Скачайте `BUILD-LOGS` из **【Artifacts】** и сначала откройте `00-SUMMARY.txt`. Затем выясните, связана ли ошибка с объёмом RootFS, временем, исходным кодом или зависимостями. См. [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). После исправления создайте **новый Issue**.

</details>

<details>
<summary>Можно ли перезапустить старый Run с новыми настройками?</summary>

Нет: повторный запуск использует исходный запрос и закреплённые версии кода и данных. Загрузите новую конфигурацию на сайте, проверьте её и создайте новый запрос и Issue.

</details>

## Разработка и развёртывание

Для обычной сборки клонировать репозиторий и устанавливать Node.js не требуется. Техническая информация: [руководство разработчика (англ.)](../docs/DEVELOPER.md) и [описание архитектуры (англ.)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) собирает и публикует данные об исходных ветках, профилях устройств, пакетах, зависимостях Kconfig и совместимости. И сайт, и сборщик используют эти данные без второй базы устройств и пакетов в AutoBuild.

## Благодарности

Спасибо проектам [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) и [авторам пакетов](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Лицензия

Проект распространяется по лицензии [GNU GPLv3](../LICENSE) или более новой версии. Авторские права и контакты — в [NOTICE](../NOTICE).
