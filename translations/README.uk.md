# Wei.G OpenWrt — створюйте власну прошивку онлайн

Виберіть пристрій і пакунки у браузері, надішліть запит через GitHub, а компіляцію прошивки OpenWrt виконає хмарний сервіс.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Зручно на телефоні · 🌙 Світла й темна теми · ✅ Різні системи на основі OpenWrt**

**[🌐 Відкрити конфігуратор](https://www.weigshare.com/wrt/) · [⬇️ Завантажити прошивку](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Підтримувані системи:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Мова:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Інші мови</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; **Українська** &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Попередній перегляд інтерфейсу

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Початок роботи: три кроки до прошивки

**📖 [Повний посібник з ілюстраціями](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Виберіть джерело, пристрій і пакунки

Відкрийте [**【Онлайн-конфігуратор】**](https://www.weigshare.com/wrt/) і виберіть **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Позначте потрібні пакунки та налаштуйте **【Advanced menuconfig】**, часовий пояс і тему за потреби. Через **【Завантажити конфігурацію】** можна імпортувати `build-request.json`, `.config` або `config.buildinfo`. Перевірте вибір перед продовженням.

### 2. Надішліть запит на хмарне збирання через GitHub

Спочатку [**【увійдіть у GitHub】**](https://github.com/login), потім поверніться до [**【Конфігуратора】**](https://www.weigshare.com/wrt/) й натисніть **【Надіслати хмарне збирання】** → **【Завантажити запит і відкрити GitHub】**. Завантажиться файл `*.json` та відкриється форма GitHub Issue. На комп’ютері перетягніть JSON у поле запиту й натисніть **【Submit new issue】**. Бот відповість посиланням на виконання.

<details>
<summary><strong>Важливі зауваження (розгорнути)</strong></summary>

> Кнопка **【Тест】** на плавучій панелі праворуч унизу перевіряє налаштування та сумісність; під час створення запиту перевірка запускається автоматично.
>
> Якщо знайдено проблему, застосуйте виправлення або виберіть **【Зберегти й продовжити примусово】**. Це не усуває помилки у вихідному коді, тому збирання може не вдатися.
>
> Скористайтеся сторінкою GitHub Issue, яку відкрив конфігуратор, щоб не втратити заповнені дані.
>
> Саме завантаження JSON **не запускає збирання**. Потрібно надіслати Issue.
>
> Не публікуйте справжні паролі, токени та інші секрети у відкритих Issues, запитах або журналах.

</details>

### 3. Завантажте прошивку

Перейдіть за посиланням у вашому Issue або відкрийте [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Після успіху завантажте прошивку в **【Artifacts】**. `CONFIG` містить налаштування, `BUILD-LOGS` — журнали діагностики; **це не образи прошивки для запису на пристрій**. Файли зберігаються **60 днів**.

## Поширені запитання

<details>
<summary>Чому за великої кількості пакунків бракує місця в RootFS?</summary>

Пакунки й залежності можуть перевищити розмір розділу RootFS. Якщо пристрій підтримує зміну, знайдіть `TARGET_ROOTFS_PARTSIZE` у **【Advanced menuconfig】** → **【Target Images】** і встановіть, наприклад, 512 або 1024 MiB. Деякі апаратні маршрутизатори мають незмінні розділи — тоді скоротіть кількість пакунків. Див. [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Чому тривале збирання зупиняється?</summary>

Завдання Job на GitHub-hosted Runner зазвичай обмежене шістьма годинами. У проєкті ліміт становить **350 хвилин**, а виконання зупиняється через **335 хвилин**, щоб зібрати журнали. Це **зупинка, а не пауза з можливістю відновлення**.

</details>

<details>
<summary>Як з’ясувати причину невдалого збирання?</summary>

Завантажте `BUILD-LOGS` із **【Artifacts】**, спочатку прочитайте `00-SUMMARY.txt`. Перевірте RootFS, час, вихідний код і залежності. Приклади: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Після змін створіть **новий Issue**.

</details>

<details>
<summary>Чи можна перезапустити старий Run з новими налаштуваннями?</summary>

Ні. Старий Run використовує вихідний запит та зафіксовані версії коду й даних. Перевірте нову конфігурацію в поточному застосунку й надішліть новий запит.

</details>

## Розробка та розгортання

Для роботи із сайтом не потрібно клонувати репозиторій чи встановлювати Node.js. Технічні відомості англійською: [посібник розробника](../docs/DEVELOPER.md) і [опис архітектури](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) публікує гілки джерел, профілі пристроїв, пакунки, залежності Kconfig і сумісність для сайту та системи збирання.

## Подяки

Дякуємо [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [а також усім авторам пакунків і учасникам](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Ліцензія

Проєкт поширюється за [GNU GPLv3 або новішою](../LICENSE). Авторські права й контакти — у [NOTICE](../NOTICE).
