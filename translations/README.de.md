# Wei.G OpenWrt – Firmware online zusammenstellen

Gerät und Pakete im Browser auswählen, den Auftrag über GitHub einreichen und die OpenWrt-Firmware in der Cloud erstellen lassen.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Für Mobilgeräte optimiert · 🌙 Helles und dunkles Design · ✅ Verschiedene OpenWrt-Varianten**

**[🌐 Konfigurator öffnen](https://www.weigshare.com/wrt/) · [⬇️ Firmware herunterladen](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Unterstützte Systeme:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Sprache:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Deutsch** · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Weitere Sprachen</b></summary>

<div dir="ltr">
Asturianu &lrm;·&lrm; Azərbaycanca &lrm;·&lrm; Беларуская &lrm;·&lrm; Български &lrm;·&lrm; বাংলা &lrm;·&lrm; বাংলা (বাংলাদেশ) &lrm;·&lrm; Català &lrm;·&lrm; Čeština &lrm;·&lrm; Dansk &lrm;·&lrm; Ελληνικά &lrm;·&lrm; Suomi &lrm;·&lrm; Filipino &lrm;·&lrm; Gaeilge &lrm;·&lrm; हिन्दी &lrm;·&lrm; Magyar &lrm;·&lrm; Bahasa Indonesia &lrm;·&lrm; Italiano &lrm;·&lrm; ქართული &lrm;·&lrm; ລາວ &lrm;·&lrm; Lietuvių &lrm;·&lrm; Latviešu &lrm;·&lrm; മലയാളം &lrm;·&lrm; मराठी &lrm;·&lrm; Bahasa Melayu &lrm;·&lrm; Norsk bokmål &lrm;·&lrm; Nederlands &lrm;·&lrm; Polski &lrm;·&lrm; Português (Brasil) &lrm;·&lrm; Română &lrm;·&lrm; Slovenčina &lrm;·&lrm; Svenska &lrm;·&lrm; தமிழ் &lrm;·&lrm; Türkçe &lrm;·&lrm; Українська &lrm;·&lrm; Màaya t'aan &lrm;·&lrm; &#x2067;العربية&#x2069; &lrm;·&lrm; &#x2067;فارسی&#x2069; &lrm;·&lrm; &#x2067;עברית&#x2069; &lrm;·&lrm; &#x2067;اردو&#x2069;
</div>

</details>

## Oberflächenvorschau

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt Desktopansicht" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt Mobilansicht" width="21.30%">
</p>

## Erste Schritte: In drei Schritten zur Firmware

**📖 [Ausführliche bebilderte Anleitung](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Quellcode, Gerät und Pakete auswählen

Öffne den [**【Online-Konfigurator】**](https://www.weigshare.com/wrt/) und wähle nacheinander **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Unter **【② Pakete auswählen】** legst du die gewünschten Funktionen fest. Bei Bedarf passt du **【Advanced menuconfig】**, Zeitzone und Design an.

Wenn du bereits eine Konfiguration hast, wähle **【Konfiguration laden】** und importiere `build-request.json`, `.config` oder `config.buildinfo`. Prüfe anschließend Quelle, Gerät und Pakete.

### 2. Cloud-Build über GitHub starten

[**【Melde dich zuerst bei GitHub an】**](https://github.com/login), kehre zum [**【Konfigurator】**](https://www.weigshare.com/wrt/) zurück und wähle **【Cloud-Build einreichen】** → **【Anfrage herunterladen und GitHub öffnen】**. Dabei wird eine `*.json`-Datei heruntergeladen und ein GitHub-Issue-Formular geöffnet. Am Computer ziehst du die JSON-Datei in das Anfragefeld und klickst auf **【Submit new issue】**.

Nach dem Absenden antwortet der Bot im Issue mit einem Link zum Build.

<details>
<summary><strong>Wichtige Hinweise (aufklappen)</strong></summary>

> **Hinweis:** Mit **【Testen】** in der schwebenden Leiste unten rechts kannst du Konfigurationsfehler und Kompatibilitätshinweise vorab prüfen. Beim Erzeugen der Anfrage über **【Anfrage herunterladen und GitHub öffnen】** geschieht das ebenfalls automatisch.
>
> Werden Probleme erkannt, kannst du einen Vorschlag übernehmen oder **【Beibehalten und trotzdem fortfahren】** wählen. Das behebt keine Fehler im Upstream-Quellcode; der Build kann weiterhin scheitern.
>
> Verwende das vom Konfigurator automatisch geöffnete GitHub-Issue-Formular, damit die vorausgefüllten Angaben erhalten bleiben.
>
> Eine heruntergeladene JSON-Datei ohne abgesendetes Issue **startet keinen Build**.
>
> Veröffentliche keine echten Passwörter, Zugangstoken oder andere Geheimnisse in öffentlichen Issues, Anfragen oder Logs.

</details>

### 3. Firmware herunterladen

Folge dem Link im Issue oder suche den Lauf unter [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Nach erfolgreichem Abschluss findest du die Firmware unten bei **【Artifacts】**. `CONFIG` enthält Konfigurationsdateien und `BUILD-LOGS` Diagnoseprotokolle – **beides sind keine flashbaren Firmware-Dateien**. Die Downloads werden **60 Tage** aufbewahrt.

## Häufige Fragen

<details>
<summary>Warum reicht der RootFS-Speicher bei vielen Paketen nicht aus?</summary>

Pakete und Abhängigkeiten können die Größe der RootFS-Partition überschreiten. Falls das Zielgerät es unterstützt, findest du unter **【Advanced menuconfig】** → **【Target Images】** die Option `TARGET_ROOTFS_PARTSIZE`, beispielsweise für 512 oder 1024 MiB. Bei vielen Hardware-Routern ist die Größe durch Flash-Speicher oder Partitionierung fest vorgegeben. Entferne dann unnötige Pakete. Siehe [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Warum bricht ein lang laufender Build ab?</summary>

Ein GitHub-gehosteter Runner erlaubt für einen Job normalerweise höchstens sechs Stunden. Hier gilt eine Grenze von **350 Minuten**, während die Ausführung nach **335 Minuten** endet, damit Zeit für Logs bleibt. Der Build wird **beendet, nicht für eine spätere Fortsetzung pausiert**. Große Abhängigkeiten wie Node.js oder Rust können die Dauer stark erhöhen.

</details>

<details>
<summary>Wie gehe ich bei einem fehlgeschlagenen Build vor?</summary>

Lade unter **【Artifacts】** die `BUILD-LOGS` herunter und lies zuerst `00-SUMMARY.txt`. Prüfe danach RootFS-Größe, Zeitlimits und Fehler in Upstream-Quellen oder Abhängigkeiten. Beispiele liefert [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Nach einer Änderung ist ein **neues Issue** erforderlich.

</details>

<details>
<summary>Kann ich einen alten Run mit neuer Konfiguration erneut starten?</summary>

Nein. Ein erneut gestarteter Run verwendet weiterhin die ursprünglich fixierte Anfrage sowie den damaligen Code- und Datenstand. Lade die geänderte Konfiguration im aktuellen Konfigurator und stelle eine neue Anfrage.

</details>

## Entwicklung und Bereitstellung

Wer nur eine Firmware erstellen möchte, muss weder das Repository klonen noch Node.js installieren. Für die technische Umsetzung gibt es den [Entwicklerleitfaden (Englisch)](../docs/DEVELOPER.md) und die [Architekturdokumentation (Englisch)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) stellt Informationen zu Quellcodezweigen, Geräteprofilen, Paketen, Kconfig-Abhängigkeiten und Kompatibilität bereit. Website und Build-Worker verwenden dieselben Daten; AutoBuild führt keine zweite Geräte- oder Paketdatenbank.

## Danksagung

Vielen Dank an [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) sowie an [alle Paketautoren und Mitwirkenden](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lizenz

Dieses Projekt steht unter [GNU GPLv3](../LICENSE) oder einer neueren Version. Angaben zu Urheberrecht und Kontakt stehen in [NOTICE](../NOTICE).
