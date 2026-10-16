# Wei.G OpenWrt — personalizza il firmware online

Scegli il dispositivo e i pacchetti dal browser, invia la richiesta su GitHub e lascia che il firmware OpenWrt venga compilato nel cloud.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Ottimizzato per smartphone · 🌙 Tema chiaro e scuro · ✅ Supporto a diverse distribuzioni derivate da OpenWrt**

**[🌐 Apri il configuratore](https://www.weigshare.com/wrt/) · [⬇️ Scarica il firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribuzioni supportate:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Lingua:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Altre lingue</b></summary>

<div dir="ltr">
Asturianu &lrm;·&lrm; Azərbaycanca &lrm;·&lrm; Беларуская &lrm;·&lrm; Български &lrm;·&lrm; বাংলা &lrm;·&lrm; বাংলা (বাংলাদেশ) &lrm;·&lrm; Català &lrm;·&lrm; Čeština &lrm;·&lrm; Dansk &lrm;·&lrm; Ελληνικά &lrm;·&lrm; Suomi &lrm;·&lrm; Filipino &lrm;·&lrm; Gaeilge &lrm;·&lrm; हिन्दी &lrm;·&lrm; Magyar &lrm;·&lrm; Bahasa Indonesia &lrm;·&lrm; **Italiano** &lrm;·&lrm; ქართული &lrm;·&lrm; ລາວ &lrm;·&lrm; Lietuvių &lrm;·&lrm; Latviešu &lrm;·&lrm; മലയാളം &lrm;·&lrm; मराठी &lrm;·&lrm; Bahasa Melayu &lrm;·&lrm; Norsk bokmål &lrm;·&lrm; Nederlands &lrm;·&lrm; Polski &lrm;·&lrm; Português (Brasil) &lrm;·&lrm; Română &lrm;·&lrm; Slovenčina &lrm;·&lrm; Svenska &lrm;·&lrm; தமிழ் &lrm;·&lrm; Türkçe &lrm;·&lrm; Українська &lrm;·&lrm; Màaya t'aan &lrm;·&lrm; &#x2067;العربية&#x2069; &lrm;·&lrm; &#x2067;فارسی&#x2069; &lrm;·&lrm; &#x2067;עברית&#x2069; &lrm;·&lrm; &#x2067;اردو&#x2069;
</div>

</details>

## Anteprima dell'interfaccia

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt interfaccia desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt interfaccia mobile" width="21.30%">
</p>

## Per iniziare: il firmware in tre passaggi

**📖 [Guida illustrata completa](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Scegli sorgente, dispositivo e pacchetti

Apri il [**【Configuratore online】**](https://www.weigshare.com/wrt/) e seleziona **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Scegli i pacchetti necessari e, se serve, modifica **【Advanced menuconfig】**, fuso orario e tema. Per recuperare una configurazione precedente, usa **【Carica configurazione】** con `build-request.json`, `.config` o `config.buildinfo` e ricontrolla le impostazioni.

### 2. Invia la compilazione tramite GitHub

[**【Accedi a GitHub】**](https://github.com/login), torna al [**【Configuratore】**](https://www.weigshare.com/wrt/) e fai clic su **【Invia compilazione cloud】** → **【Scarica richiesta e apri GitHub】**. Verrà scaricato un file `*.json` e si aprirà un modulo GitHub Issue. Da computer trascina il JSON nel campo della richiesta, quindi premi **【Submit new issue】**. Il bot risponderà con il link alla compilazione.

<details>
<summary><strong>Avvertenze (espandi)</strong></summary>

> **Suggerimento:** Puoi verificare in anticipo configurazione e compatibilità usando **【Test】** nella barra flottante in basso a destra; il controllo viene eseguito anche quando scarichi la richiesta.
>
> Se vengono rilevati problemi, puoi applicare le correzioni suggerite oppure scegliere **【Mantieni e continua comunque】**. Forzare la procedura non risolve gli errori presenti nel codice sorgente a monte.
>
> Usa la pagina GitHub Issue aperta dal configuratore per non perdere i dati precompilati.
>
> Scaricare il JSON senza inviare l'Issue **non avvia alcuna compilazione**.
>
> Non pubblicare password reali, token o altre informazioni riservate in Issues, richieste o registri pubblici.

</details>

### 3. Scarica il firmware

Segui il link nell'Issue oppure apri [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Al termine della compilazione, trovi il firmware in **【Artifacts】** in fondo alla pagina. `CONFIG` contiene le impostazioni e `BUILD-LOGS` i log diagnostici: **non sono immagini da installare sul router**. I file rimangono disponibili per **60 giorni**.

## Domande frequenti

<details>
<summary>Perché con tanti pacchetti lo spazio RootFS non basta?</summary>

Pacchetti e dipendenze possono superare la dimensione della partizione RootFS. Se il dispositivo lo consente, cerca `TARGET_ROOTFS_PARTSIZE` in **【Advanced menuconfig】** → **【Target Images】** e valuta 512 o 1024 MiB. Su alcuni router fisici la memoria flash o la disposizione delle partizioni impedisce la modifica: occorre ridurre i pacchetti. Vedi [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Perché la compilazione viene interrotta dopo molto tempo?</summary>

Un job sui runner GitHub ha normalmente un limite di sei ore. Qui il massimo è **350 minuti**, con una scadenza di esecuzione a **335 minuti** per lasciare spazio alla raccolta dei log. Raggiunto il limite, la compilazione **si interrompe: non è sospesa per essere ripresa**. Pacchetti complessi come Node.js e Rust possono richiedere più tempo.

</details>

<details>
<summary>Come posso individuare la causa di un errore?</summary>

Scarica `BUILD-LOGS` da **【Artifacts】** e leggi prima `00-SUMMARY.txt`. Controlla se il problema riguarda RootFS, tempo massimo, sorgenti o dipendenze. Consulta [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Dopo la correzione apri **un nuovo Issue**.

</details>

<details>
<summary>Posso rilanciare un vecchio Run dopo aver modificato la configurazione?</summary>

No: il vecchio Run usa la richiesta e le versioni di codice e dati fissate al momento dell'invio. Ricarica la configurazione nel sito, esegui i controlli e invia una nuova richiesta.

</details>

## Sviluppo e distribuzione

Per usare il servizio non serve clonare il repository né installare Node.js. Per gli sviluppatori sono disponibili la [guida allo sviluppo (inglese)](../docs/DEVELOPER.md) e la [documentazione dell'architettura (inglese)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) raccoglie rami sorgente, profili dei dispositivi, pacchetti, dipendenze Kconfig e informazioni di compatibilità. Il sito e la compilazione usano gli stessi dati, senza duplicare il catalogo in AutoBuild.

## Ringraziamenti

Grazie a [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) e a [tutti gli autori dei pacchetti e collaboratori](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licenza

Il progetto è distribuito con licenza [GNU GPLv3](../LICENSE) o successiva. Per copyright e contatti consulta [NOTICE](../NOTICE).
