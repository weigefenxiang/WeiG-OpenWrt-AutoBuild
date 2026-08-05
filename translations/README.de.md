# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · Deutsch · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

OpenWrt-Firmware **online anpassen + in der Cloud kompilieren**. Wählen Sie auf der Webseite Quellcode, Version und Plugins aus – GitHub Actions kompiliert automatisch, und Sie holen sich die Firmware kostenlos ab.

Derzeit ist der **360T7 (MT7981)** das vollständig gepflegte Modell; die übrigen über 200 Modelle auf der Seite sind im **Seed-Modus** verfügbar (garantiert ist lediglich das Niveau „bootet grundsätzlich“, ohne Verifizierung auf realer Hardware – Nutzung auf eigene Gefahr; wie ein Modell in die vollständig gepflegte Stufe aufsteigt, erfahren Sie unten im Abschnitt für Maintainer).

⭐ **Ein Star ist die größte Unterstützung – Ihr Star ist meine Motivation für weitere Updates!**

- Anpassungsseite (Hauptseite): <https://wrt.weigefenxiang.cc.cd>
- Anpassungsseite (Backup-Kopie im Blog): <https://www.weigeshare.cc.cd/wrt/>
- Drei Quellcode-Produktlinien: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt (offiziell)](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Versionszweige**: Alle entfernten ImmortalWrt-Zweige werden erfasst. OpenWrt umfasst `main` und alle `openwrt-*`-Zweige, jedoch nicht `lede-17.01`, `pcs-standalone-back` und `master`. Die Seite erzeugt je Quelle, Zweig und Geräteprofil eine eigene Konfiguration und zeigt nur upstream tatsächlich vorhandene Kombinationen.
- Die Oberfläche unterstützt **11 Sprachen** (vereinfachtes Chinesisch / traditionelles Chinesisch / Englisch / Russisch / Spanisch / Portugiesisch / Japanisch / Koreanisch / Deutsch / Französisch / Vietnamesisch), folgt automatisch der Browsersprache und lässt sich oben rechts manuell umschalten; fehlende Übersetzungen fallen automatisch auf Englisch zurück

---

## Für Anwender: So passen Sie die Firmware an

1. Öffnen Sie die Anpassungsseite, wählen Sie **Source → Branch → Target System → Subtarget → Target Profile → Plugins** und geben Sie eine Build-Kennung ein.
2. Klicke auf **Cloud-Build senden → Anfrage herunterladen und GitHub öffnen**. Lade nur die soeben erzeugte `build-request.json` hoch und klicke auf **Create**; Gerät, Quelle, Version und Partition müssen nicht eingegeben werden. Eine vorhandene `.config` oder `config.buildinfo` zuerst auf der Webseite laden, damit das Gerät erkannt wird.
3. Der Bot antwortet im Issue mit dem Link zu diesem Build; die komplette Kompilierung dauert etwa **2–3 Stunden**.
4. Nach Abschluss des Builds benachrichtigt der Bot Sie per Kommentar. Öffnen Sie die Build-Seite und laden Sie unten unter **Artifacts** herunter:
   - `Zeitstempel-Originalname.img.gz`: jedes finale Image direkt und ohne ZIP; beim ersten Flashen meist `factory`;
   - `Zeitstempel-CONFIG`: eingereichte/effektive Konfigurationen und Metadaten;
   - `Zeitstempel-BUILD-LOGS`: vollständige Protokolle und Fehler, 14 Tage verfügbar;
   - `Zeitstempel-OPTIONAL-PACKAGES` / `Zeitstempel-FIRMWARE-OTHER`: M-Pakete und Begleitdateien.
5. Ohne Kompilierung wählst du **Cloud-Build senden → Nur .config herunterladen**. Actions führt `make defconfig` nur aus, wenn **Defconfig** ausdrücklich aktiviert wurde; andernfalls bleibt die vollständige `.config` maßgeblich. Erforderliche Quelloptionen werden vor dem Download angezeigt und nur nach Bestätigung angewendet.
6. Die Seite lädt `build-request.json`, `.config` und `config.buildinfo`. Das Zeitzonenfeld durchsucht die vollständige IANA-Liste von OpenWrt/LuCI im einheitlichen Format `(UTC±HH:MM) Region/City`; außerdem sind LuCI-Theme, NTP und opkg-Spiegel wählbar.

> 💡 Nach dem Flashen der Firmware: Rufen Sie im Browser **192.168.1.1** auf (oder die Adresse, die Sie auf der Absendeseite angepasst haben), Benutzername **root**; **das Passwort ist leer** (bitte setzen Sie beim ersten Login sofort eines) – nur bei der Quelle Lean LEDE lautet das Anfangspasswort `password`.
>
> 💡 Oben rechts auf der Seite gibt es eine Schaltfläche **Selbsttest**: Sie prüft mit einem Klick die Erreichbarkeit der Datenquellen (drei Ebenen: lokal / jsDelivr / raw), die Logik der .config-Generierung und die GitHub-Konnektivität. Klicken Sie bei Ladeproblemen zuerst darauf.
>
> 💡 Wenn Sie ein Plugin mit Abhängigkeiten auswählen (z. B. den MWAN3-Lastverteilungs-Helfer), werden die vorausgesetzten Plugins automatisch mit angehakt; Abhängigkeiten auf Kernel-/Bibliotheksebene werden beim Kompilieren automatisch ergänzt – darum müssen Sie sich nicht kümmern.
>
> ⚠️ Zum Herunterladen der Artifacts müssen Sie bei GitHub angemeldet sein. Firmware, Konfiguration und Build-Infos werden 30 Tage aufbewahrt; `BUILD-LOGS` 14 Tage.
>
> ⚠️ Das Flashen birgt Risiken. Die Variante **108M-Großpartition** setzt voraus, dass Sie bereits das „unzerstörbare“ U-Boot (ubootmod) geflasht haben; die Variante **Werkspartition** lässt sich ohne Partitionsänderung direkt flashen, bietet aber wenig Speicherplatz – wählen Sie zu viele Plugins aus, schlägt die Kompilierung fehl oder die Firmware passt nicht auf das Gerät.

### So finden Sie Ihre Firmware in Actions

Die Build-Liste ist nach dem Muster `Build 定制 · 你的标识 · 源码 版本/变体` benannt – achten Sie einfach auf die von Ihnen eingegebene Kennung: Repository → **Actions** → **custom-build**.

## Eigener Build per Fork

Wenn Sie nicht in der Warteschlange des öffentlichen Repositorys warten oder die Standardkonfiguration ändern möchten, können Sie alles vollständig selbst erledigen:

1. Klicken Sie oben rechts auf **Fork**, um dieses Repository in Ihr Konto zu kopieren;
2. Aktivieren Sie in Ihrem Fork unter **Settings → Features die Option Issues** und klicken Sie anschließend auf der **Actions-Seite auf die grüne Schaltfläche, um die Workflows zu aktivieren**;
3. Kehren Sie zur Anpassungsseite zurück, wählen Sie in Schritt ④ **Mein eigener Fork** und geben Sie Ihren GitHub-Benutzernamen ein – danach laufen die von Ihnen eingereichten Builds über Ihr eigenes kostenloses Kontingent;
4. Die Seite lädt `build-request.json` herunter und öffnet ein Issue-Formular mit nur einem Pflichtanhang. Nach dem Hochladen verwendet Actions die vollständige `.config` darin direkt und erzeugt sie nicht erneut aus der base config des Repositorys.

## Für Maintainer: So fügen Sie Plugins hinzu / ändern die Konfiguration

Datenfluss: `config/<Marke>/<Modell>/*.config` bleibt für den Import älterer Konfigurationen und historische Anfragen erhalten (für den 360T7 gibt es derzeit 14 Quell-/Branch-/Profile-Konfigurationen). Neue Build-Parameter kommen dynamisch aus `WeiG-OpenWrt-Menuconfig-Catalog`; jeder Issue-Build verwendet die vollständige, in `build-request.json` exportierte `.config` als endgültige Eingabe.

### Eine neue Plugin-Option hinzufügen

1. Stellen Sie sicher, dass die Zeile `# CONFIG_PACKAGE_luci-app-xxx is not set` für das Paket in den vier Base-Konfigurationen bereits vorhanden ist (fehlt sie, gibt es das Paket in den Feeds dieser Quelle nicht – fügen Sie dann zuerst im diy-Skript den Feed hinzu und aktualisieren Sie die Base-Konfiguration);
2. Fügen Sie im Array `plugins` in `tools/plugins-meta.json` einen Eintrag hinzu: `{ "id": "xxx", "name": "中文名", "group": "分组", "desc": "一句话说明", "size": 2, "hot": false }` (weicht der Paketname vom Suffix `luci-app-` ab oder heißt das Paket in den drei Quellen unterschiedlich, ergänzen Sie das Feld `pkgs` für eine explizite Zuordnung; gibt es vorausgesetzte Plugins auf luci-app-Ebene, ergänzen Sie `requires: ["前置id"]` – die Seite hakt sie dann automatisch mit an);
3. Führen Sie `node tools/gen-plugins.mjs` aus – das Skript generiert `site/wrt/data/360t7/plugins.json` neu, hält die maßgeblichen Base-Konfigurationen ausschließlich unter `config/` und warnt zugleich vor Plugins, die zwar in der Konfiguration vorhanden, aber nicht erfasst sind;
4. Committen und pushen Sie. Auf der Seite muss kein Code geändert werden – die neue Option erscheint automatisch.

### Ein Routermodell freischalten / neu hinzufügen

Der Modellkatalog liegt in `site/wrt/data/devices.json` und ist nach Marken organisiert; der 360T7 ist die vollständig gepflegte Stufe, alle übrigen Modelle laufen im **Seed-Modus** (ihre sources werden aus einer Vorlage generiert, sie teilen sich die Seed-Plugin-Tabelle, und garantiert ist nur, dass das Gerät bootet). So stufen Sie ein Seed-Modell zur vollständig gepflegten Stufe hoch:

1. Suchen Sie das Modell in `devices.json` und vervollständigen Sie `sources` entsprechend den tatsächlichen Gegebenheiten (pro Quelle: Name der config-Datei, versions-Zweige, variants-Varianten und Partitions-Ersetzungspaare);
2. Legen Sie die Base-Konfigurationen der einzelnen Quellen unter `config/<Marke>/<Modell-id>/` ab, Namenskonvention `<Marke>_<Modell>_<Quelle>.config` (das Repository enthält für die meisten Modelle bereits „minimal bootfähige“ Seed-Konfigurationen, die nur das Zielmodell + LuCI umfassen – Sie können sie direkt verwenden oder darauf aufbauen);
3. Führen Sie `node tools/gen-plugins.mjs` aus (generiert für jedes freigeschaltete Modell eine eigene plugins.json);
4. Smoke-Test: Führen Sie pro Quelle jeweils einen Cloud-Build aus, um sicherzustellen, dass ein Image erzeugt wird.

Am Code von Seite und Workflow ändert sich nichts; der Parameter `device` wird wie gewohnt gegen die Whitelist validiert.

### Verzeichnisstruktur und technische Architektur

Siehe [ARCHITECTURE.md](../ARCHITECTURE.md) (zweisprachig Chinesisch/Englisch).

### Sicherheit

- Issues akzeptieren 1–3 auf GitHub gehostete Anhänge und erkennen `build-request.json`, `.config` und `config.buildinfo`; Felder, Positivlisten, Größe, Zielsignatur und erforderliche Quelloptionen werden geprüft. Die vollständige Konfiguration ist standardmäßig maßgeblich; nur bei ausdrücklich aktiviertem Defconfig läuft `make defconfig` einmal mit Schutzprüfung für Target, Profile, Architektur und Pflichtpakete.
- Die Build-Kennung (tag) wird auf chinesische und lateinische Zeichen, Ziffern und Bindestriche bereinigt und ausschließlich für die artifact-Benennung und die Anzeige verwendet;
- Die Workflow-Berechtigungen sind auf `contents: read + issues: write` beschränkt.

### Konvention für die mehrsprachige Dokumentationspflege

**Bei jeder Änderung an dieser README (oder an einer beliebigen nutzerorientierten md-Datei) müssen die entsprechenden Sprachversionen unter `translations/` synchron aktualisiert werden**; dasselbe gilt für die Entwicklerdokumentation (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). Das ist eine feste Regel, die verhindert, dass die Sprachversionen auseinanderdriften.

## Danksagung

Unser Dank gilt allen Open-Source-Projekten und Autoren, die direkt oder indirekt zu diesem Projekt beigetragen haben:

- **Quellcode**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Infrastruktur**: [GitHub Actions](https://github.com/features/actions) (Cloud-Kompilierung) · [Cloudflare Pages](https://pages.cloudflare.com/) (Hosting der Backup-Seite)
- **allen Autoren der <!--plugin-count-->242<!--/plugin-count--> LuCI-Plugins** sowie den Ökosystem-Projekten wie LuCI, Hexo und dem Butterfly-Theme;
- jedem Nutzer, der ein Issue eingereicht, ein Problem gemeldet oder einen Star vergeben hat.

Dieses Projekt orchestriert die genannten Projekte lediglich; alle Rechte verbleiben bei den jeweiligen Autoren.
