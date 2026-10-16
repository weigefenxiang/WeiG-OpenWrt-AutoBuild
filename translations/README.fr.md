# Wei.G OpenWrt — personnalisez votre firmware en ligne

Choisissez votre appareil et vos paquets dans le navigateur, envoyez votre demande via GitHub et laissez la compilation du firmware OpenWrt s'effectuer dans le cloud.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Adapté aux mobiles · 🌙 Thèmes clair et sombre · ✅ Plusieurs distributions basées sur OpenWrt**

**[🌐 Ouvrir le configurateur](https://www.weigshare.com/wrt/) · [⬇️ Télécharger le firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distributions prises en charge:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Langue:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · **Français** · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Autres langues</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Aperçu de l'interface

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt Vue sur ordinateur" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt Vue sur mobile" width="21.30%">
</p>

## Bien démarrer : trois étapes pour créer votre firmware

**📖 [Guide illustré complet](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Choisir la source, l'appareil et les paquets

Ouvrez le [**【Configurateur en ligne】**](https://www.weigshare.com/wrt/) et sélectionnez **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Cochez les fonctionnalités voulues dans **【② Sélectionner les paquets】**, puis ajustez **【Advanced menuconfig】**, le fuseau horaire ou le thème au besoin.

Vous avez déjà une configuration ? Cliquez sur **【Charger une configuration】** et importez `build-request.json`, `.config` ou `config.buildinfo`. Vérifiez ensuite la source, le modèle et les paquets choisis.

### 2. Envoyer une demande de compilation sur GitHub

Commencez par [**【vous connecter à GitHub】**](https://github.com/login), puis revenez au [**【Configurateur】**](https://www.weigshare.com/wrt/) et cliquez sur **【Lancer une compilation cloud】** → **【Télécharger la demande et ouvrir GitHub】**. Le navigateur télécharge un fichier `*.json` et ouvre un formulaire d'Issue GitHub. Sur ordinateur, glissez le JSON dans le champ de la demande, puis cliquez sur **【Submit new issue】**.

Après l'envoi, un bot répond dans l'Issue avec un lien vers la compilation.

<details>
<summary><strong>Informations importantes (déplier)</strong></summary>

> **Astuce:** Le bouton **【Tester】** dans la barre flottante en bas à droite permet de vérifier la configuration et les conseils de compatibilité à l'avance. La commande **【Télécharger la demande et ouvrir GitHub】** lance aussi automatiquement ces vérifications.
>
> Si un problème est détecté, appliquez le correctif proposé ou choisissez **【Conserver et forcer la poursuite】**. Forcer la poursuite ne résout pas un bogue du code source amont et ne garantit pas la réussite.
>
> Utilisez le formulaire d'Issue ouvert automatiquement par le configurateur pour conserver les informations préremplies.
>
> Télécharger le JSON sans envoyer d'Issue **ne déclenche aucune compilation**.
>
> Ne publiez jamais de vrais mots de passe, jetons d'accès ou autres secrets dans des Issues publics, des demandes ou des journaux.

</details>

### 3. Récupérer le firmware

Suivez le lien indiqué dans l'Issue ou recherchez votre tâche sous [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Une fois terminée, téléchargez le firmware dans **【Artifacts】** en bas de la page. `CONFIG` contient la configuration et `BUILD-LOGS` les journaux de diagnostic : **ces fichiers ne sont pas des images de firmware à flasher**. Les téléchargements restent disponibles **60 jours**.

## Questions fréquentes

<details>
<summary>Pourquoi trop de paquets peuvent-ils saturer RootFS ?</summary>

Les paquets et leurs dépendances peuvent dépasser l'espace de la partition RootFS. Si l'appareil l'autorise, recherchez `TARGET_ROOTFS_PARTSIZE` dans **【Advanced menuconfig】** → **【Target Images】** et adaptez la taille, par exemple à 512 ou 1024 MiB. Certains routeurs matériels ne permettent pas ce réglage en raison de leur mémoire flash ou de leur partitionnement : retirez alors des paquets. Voir [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Pourquoi une compilation trop longue finit-elle en échec ?</summary>

Sur un runner hébergé par GitHub, un Job dure généralement au maximum six heures. Le projet fixe une limite de **350 minutes** et arrête l'exécution au bout de **335 minutes** afin de conserver du temps pour les journaux. La compilation est **arrêtée, pas mise en pause pour reprise ultérieure**. De grosses dépendances comme Node.js ou Rust peuvent augmenter la durée.

</details>

<details>
<summary>Comment diagnostiquer une compilation en échec ?</summary>

Récupérez `BUILD-LOGS` dans **【Artifacts】** et commencez par `00-SUMMARY.txt`. Recherchez ensuite un manque d'espace RootFS, un dépassement de délai, un défaut du code amont ou un conflit de dépendances. Consultez [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Après correction, créez **une nouvelle Issue**.

</details>

<details>
<summary>Puis-je relancer un ancien Run après avoir modifié les paramètres ?</summary>

Non : l'ancien Run utilise toujours la demande, le code et les données figés à l'origine. Rechargez et vérifiez la configuration mise à jour dans le configurateur, puis soumettez une nouvelle Issue.

</details>

## Développement et déploiement

Pour créer un firmware avec le site, il n'est pas nécessaire de cloner le dépôt ni d'installer Node.js. Pour les aspects techniques, consultez le [guide du développeur (en anglais)](../docs/DEVELOPER.md) et la [documentation de l'architecture (en anglais)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) collecte et publie les branches de code, profils d'appareils, paquets, dépendances Kconfig et données de compatibilité. Le configurateur et les builds utilisent les mêmes informations, sans seconde base de données dans AutoBuild.

## Remerciements

Merci à [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) ainsi qu'à [tous les auteurs de paquets et contributeurs](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Licence

Ce projet est distribué sous licence [GNU GPLv3](../LICENSE) ou ultérieure. Droits d'auteur et coordonnées dans [NOTICE](../NOTICE).
