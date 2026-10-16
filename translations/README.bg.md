# Wei.G OpenWrt — настройте фърмуера си онлайн

Изберете устройство и пакети в браузъра, изпратете заявка през GitHub и оставете OpenWrt фърмуерът да се компилира в облака.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Подходящо за телефон · 🌙 Светла и тъмна тема · ✅ Различни OpenWrt системи**

**[🌐 Отвори конфигуратора](https://www.weigshare.com/wrt/) · [⬇️ Изтегли фърмуера](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Поддържани системи:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Език:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Други езици</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; **Български** &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Преглед на интерфейса

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Първи стъпки: фърмуер в три стъпки

**📖 [Пълно ръководство със снимки](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Изберете източник, устройство и пакети

Отворете [**【Онлайн конфигуратора】**](https://www.weigshare.com/wrt/) и изберете **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Маркирайте пакетите и при нужда променете **【Advanced menuconfig】**, часовата зона и темата. **【Зареждане на конфигурация】** приема `build-request.json`, `.config` и `config.buildinfo`. Проверете избора си.

### 2. Подайте заявка за облачно компилиране

Първо [**【влезте в GitHub】**](https://github.com/login), после се върнете в [**【Конфигуратора】**](https://www.weigshare.com/wrt/) и изберете **【Изпрати облачно компилиране】** → **【Изтегли заявката и отвори GitHub】**. Изтегля се `*.json` и се отваря формуляр GitHub Issue. На компютър плъзнете JSON файла в полето на заявката и натиснете **【Submit new issue】**. Ботът ще отговори с връзка към компилацията.

<details>
<summary><strong>Важни бележки (разгъни)</strong></summary>

> Проверете настройките и съвместимостта чрез **【Тест】** в плаващата лента долу вдясно. При създаване на заявка проверката се изпълнява и автоматично.
>
> При проблем използвайте препоръчаната поправка или **【Запази и продължи принудително】**. Това не коригира грешки в изходния код и компилацията може да се провали.
>
> Използвайте формуляра GitHub Issue, отворен от конфигуратора, за да запазите предварително попълнените данни.
>
> Самото изтегляне на JSON **не стартира компилация** — изпратете Issue.
>
> Не публикувайте реални пароли, токени и тайни в публични Issues, заявки и логове.

</details>

### 3. Изтеглете фърмуера

Следвайте връзката в Issue или отворете [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). След успешен завършек изтеглете фърмуера от **【Artifacts】**. `CONFIG` съдържа настройки, а `BUILD-LOGS` — диагностични логове; **това не са образи за флашване**. Файловете се пазят **60 дни**.

## Често задавани въпроси

<details>
<summary>Защо RootFS не стига при много пакети?</summary>

Пакетите и зависимостите могат да надхвърлят дяла RootFS. Ако устройството позволява, променете `TARGET_ROOTFS_PARTSIZE` в **【Advanced menuconfig】** → **【Target Images】**, например на 512 или 1024 MiB. При физическите рутери разделението на flash паметта може да е фиксирано — намалете пакетите. Вижте [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Защо дългата компилация се прекъсва?</summary>

Една задача Job на GitHub-hosted Runner обичайно е ограничена до шест часа. Проектът задава **350 минути**, а изпълнението спира след **335 минути**, за да се запазят логовете. **Спира окончателно, не се поставя на пауза за възобновяване**.

</details>

<details>
<summary>Как да разбера причината за провалена компилация?</summary>

Изтеглете `BUILD-LOGS` от **【Artifacts】** и първо прочетете `00-SUMMARY.txt`. Проверете RootFS, времето и грешки в източниците или зависимостите. Вижте [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). След промени създайте **нов Issue**.

</details>

<details>
<summary>Мога ли да пусна отново стар Run с новите настройки?</summary>

Не. Стар Run използва първоначалната заявка и фиксираните код и данни. Заредете новите настройки в сайта и подайте нова заявка.

</details>

## Разработка и внедряване

За използване на сайта не са нужни клониране на хранилището или Node.js. Подробности на английски: [ръководство за разработчици](../docs/DEVELOPER.md) и [архитектура](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) публикува изходни клонове, профили на устройства, пакети, зависимости на Kconfig и данни за съвместимост.

## Благодарности

Благодарим на [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [и на всички автори на пакети и сътрудници](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Лиценз

Проектът е под [GNU GPLv3 или по-нова](../LICENSE). Авторски права и контакти: [NOTICE](../NOTICE).
