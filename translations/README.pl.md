# Wei.G OpenWrt — dostosuj firmware przez przeglądarkę

Wybierz urządzenie i pakiety, wyślij zgłoszenie przez GitHub, a firmware OpenWrt zostanie skompilowane w chmurze.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Działa na telefonie · 🌙 Jasny i ciemny motyw · ✅ Różne odmiany OpenWrt**

**[🌐 Otwórz konfigurator](https://www.weigshare.com/wrt/) · [⬇️ Pobierz firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Obsługiwane źródła:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Język:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Więcej języków</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; **Polski** &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Podgląd interfejsu

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Pierwsze kroki: firmware w trzech etapach

**📖 [Kompletny poradnik ze zrzutami ekranu](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Wybierz źródło, urządzenie i pakiety

Otwórz [**【Konfigurator online】**](https://www.weigshare.com/wrt/) i wybierz po kolei **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Zaznacz potrzebne pakiety, a w razie potrzeby dostosuj **【Advanced menuconfig】**, strefę czasową i motyw. Przez **【Wczytaj konfigurację】** możesz zaimportować `build-request.json`, `.config` lub `config.buildinfo`; przed dalszym działaniem sprawdź ustawienia.

### 2. Zleć kompilację przez GitHub

Najpierw [**【zaloguj się do GitHub】**](https://github.com/login), wróć do [**【Konfiguratora】**](https://www.weigshare.com/wrt/) i wybierz **【Zleć kompilację w chmurze】** → **【Pobierz żądanie i otwórz GitHub】**. Strona pobierze plik `*.json` i otworzy formularz GitHub Issue. Na komputerze przeciągnij JSON do pola żądania i naciśnij **【Submit new issue】**. Bot odpowie linkiem do kompilacji.

<details>
<summary><strong>Ważne informacje (rozwiń)</strong></summary>

> Przycisk **【Test】** na pływającym pasku w prawym dolnym rogu sprawdza konfigurację i zgodność. Pobranie żądania także automatycznie uruchamia kontrolę.
>
> W razie problemu zastosuj zalecaną poprawkę albo wybierz **【Zachowaj i mimo to kontynuuj】**. Wymuszenie nie naprawia błędów w źródłach i nie gwarantuje sukcesu.
>
> Korzystaj ze strony Issue otwartej automatycznie przez konfigurator, aby nie zgubić wstępnie uzupełnionych danych.
>
> Samo pobranie JSON bez wysłania Issue **nie rozpoczyna kompilacji**.
>
> Nie publikuj prawdziwych haseł, tokenów ani innych danych poufnych w publicznych Issues, żądaniach i logach.

</details>

### 3. Pobierz firmware

Otwórz link w Issue lub znajdź uruchomienie w [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Po zakończeniu pobierz firmware z **【Artifacts】** na dole strony. `CONFIG` to konfiguracja, a `BUILD-LOGS` to dzienniki diagnostyczne — **nie są to obrazy firmware do wgrania**. Pliki pozostają dostępne przez **60 dni**.

## Często zadawane pytania

<details>
<summary>Dlaczego zbyt wiele pakietów powoduje brak miejsca w RootFS?</summary>

Pakiety i zależności mogą nie zmieścić się na partycji RootFS. Jeśli urządzenie to obsługuje, znajdź `TARGET_ROOTFS_PARTSIZE` w **【Advanced menuconfig】** → **【Target Images】** i dostosuj rozmiar, np. do 512 lub 1024 MiB. Część routerów ma stały układ pamięci flash; wtedy usuń zbędne pakiety. Przykłady: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Dlaczego długi proces kompilacji zostaje przerwany?</summary>

Limit pojedynczego Job na GitHub-hosted Runner wynosi zwykle sześć godzin. Projekt przyjmuje **350 minut**, z terminem zakończenia wykonywania po **335 minutach**, aby zapisać logi. To **zatrzymanie, nie pauza z możliwością wznowienia**. Duże pakiety Node.js i Rust wydłużają pracę.

</details>

<details>
<summary>Jak znaleźć przyczynę nieudanej kompilacji?</summary>

Pobierz `BUILD-LOGS` z **【Artifacts】** i zacznij od `00-SUMMARY.txt`. Sprawdź ograniczenia RootFS, czas, źródła i zależności. Zobacz [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Po poprawkach wyślij **nowe Issue**.

</details>

<details>
<summary>Czy mogę ponownie uruchomić stary Run dla nowej konfiguracji?</summary>

Nie. Stary Run zachowuje oryginalne żądanie oraz przypięte wersje kodu i danych. Wczytaj nową konfigurację na stronie, sprawdź ją i utwórz nowe Issue.

</details>

## Rozwój i wdrożenie

Zwykły użytkownik nie musi klonować repozytorium ani instalować Node.js. Szczegóły zawierają anglojęzyczne [wskazówki dla programistów](../docs/DEVELOPER.md) i [opis architektury](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) udostępnia dane o gałęziach źródeł, profilach urządzeń, pakietach, zależnościach Kconfig i zgodności. Strona i narzędzie budujące korzystają z jednego zestawu danych, bez drugiej bazy urządzeń i pakietów w AutoBuild.

## Podziękowania

Dziękujemy [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [oraz autorom pakietów i wszystkim współtwórcom](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licencja

Projekt jest udostępniany na [GNU GPLv3 lub nowszej](../LICENSE). Informacje o prawach autorskich i kontakcie znajdują się w [NOTICE](../NOTICE).
