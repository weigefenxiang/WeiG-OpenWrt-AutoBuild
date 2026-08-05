# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Langue / Language** : [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · Français · [Tiếng Việt](README.vi.md)

**Personnalisation en ligne + compilation cloud** de firmware OpenWrt. Choisissez la source, la version et les plugins sur une page web ; GitHub Actions compile automatiquement et vous récupérez le firmware gratuitement.

Actuellement, le **360T7 (MT7981)** est le modèle en maintenance complète ; les plus de 200 autres modèles listés sur la page sont ouverts en **mode graine** (garantie limitée au niveau « ça démarre », sans validation sur matériel réel — à vos risques et périls ; pour promouvoir un modèle au rang de maintenance complète, voir la section mainteneur ci-dessous).

⭐ **Une étoile (Star) est le meilleur soutien que vous puissiez apporter — vos Stars sont ma motivation pour continuer à mettre à jour !**

- Page de personnalisation (site principal) : <https://wrt.weigefenxiang.cc.cd>
- Page de personnalisation (copie de secours sur le blog) : <https://www.weigeshare.cc.cd/wrt/>
- Trois chaînes de sources : [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt officiel](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Branches de version** : toutes les branches distantes d’ImmortalWrt sont indexées. OpenWrt inclut `main` et toutes les branches `openwrt-*`, sauf `lede-17.01`, `pcs-standalone-back` et `master`. La page produit une configuration distincte par source, branche et profil d’appareil et n’affiche que les combinaisons réellement présentes en amont.
- L'interface est disponible en **11 langues** (chinois simplifié / chinois traditionnel / anglais / russe / espagnol / portugais / japonais / coréen / allemand / français / vietnamien), suit automatiquement la langue du navigateur et peut être changée manuellement en haut à droite ; en cas de traduction manquante, repli automatique vers l'anglais

---

## Je suis utilisateur : comment personnaliser le firmware

1. Ouvrez la page, choisissez **Source → Branch → Target System → Subtarget → Target Profile → plugins**, puis saisissez un identifiant de build.
2. Cliquez sur **Envoyer la compilation cloud → Télécharger la requête et ouvrir GitHub**. Téléversez uniquement le `build-request.json` qui vient d’être créé, puis cliquez sur **Create** ; aucun appareil, source, version ou partition n’est à saisir. Chargez d’abord tout `.config` ou `config.buildinfo` existant sur la page pour identifier l’appareil.
3. Le robot répondra dans l'Issue avec le lien de ce build ; une compilation complète prend environ **2 à 3 heures**.
4. Une fois le build terminé, le robot vous en informe par un commentaire ; ouvrez la page du build et téléchargez, en bas, sous **Artifacts** :
   - `horodatage-nom-original.img.gz` : chaque image finale directement, sans ZIP ; le premier flash utilise généralement `factory` ;
   - `horodatage-CONFIG` : configurations envoyée/effective et métadonnées ;
   - `horodatage-BUILD-LOGS` : journaux complets et erreurs, conservés 14 jours ;
   - `horodatage-OPTIONAL-PACKAGES` / `horodatage-FIRMWARE-OTHER` : paquets M et fichiers annexes.
5. Sans compilation, choisissez **Envoyer la compilation cloud → Télécharger uniquement .config**. Actions n’exécute `make defconfig` que si l’utilisateur active explicitement **Defconfig** ; sinon, la `.config` complète reste l’entrée faisant autorité. Les options obligatoires sont affichées et appliquées uniquement après confirmation.
6. La page charge `build-request.json`, `.config` et `config.buildinfo`. Le champ de fuseau recherche la liste IANA complète d’OpenWrt/LuCI au format uniforme `(UTC±HH:MM) Region/City` ; thème LuCI, NTP et miroir opkg sont également sélectionnables.

> 💡 Une fois le firmware flashé : accédez dans votre navigateur à **192.168.1.1** (ou à l'adresse que vous avez personnalisée sur la page de soumission), nom d'utilisateur **root** ; **mot de passe vide** (définissez-en un immédiatement à la première connexion) — seule la source Lean LEDE a pour mot de passe initial `password`.
>
> 💡 En haut à droite de la page se trouve un bouton **Auto-diagnostic** : en un clic, il vérifie l'accessibilité des sources de données (trois niveaux : local / jsDelivr / raw), la logique de génération du .config et la connectivité vers GitHub ; en cas de problème de chargement, commencez par là.
>
> 💡 Cocher un plugin ayant des dépendances (par ex. l'assistant de répartition de trafic MWAN3) coche automatiquement les plugins prérequis ; les dépendances au niveau du noyau et des bibliothèques sont complétées automatiquement à la compilation, vous n'avez pas à vous en soucier.
>
> ⚠️ Le téléchargement des Artifacts exige d'être connecté à GitHub. Firmware, configuration et informations de build sont conservés 30 jours ; `BUILD-LOGS`, 14 jours.
>
> ⚠️ Flasher un firmware comporte des risques. La variante **grande partition 108M** exige que vous ayez déjà flashé un U-Boot « indestructible » (ubootmod) ; la variante **partition d'origine** se flashe directement sans modifier les partitions, mais l'espace y est réduit : si vous cochez trop de plugins, la compilation échouera ou l'image ne tiendra pas.

### Retrouver votre firmware dans Actions

La liste des builds est nommée selon le schéma `Build 定制 · 你的标识 · 源码 版本/变体` ; repérez simplement l'identifiant que vous avez saisi : dépôt → **Actions** → **custom-build**.

## Fork et compilation autonome

Si vous ne voulez pas faire la queue sur le dépôt public, ou si vous souhaitez modifier la configuration par défaut, vous pouvez tout faire en autonomie :

1. Cliquez sur **Fork** en haut à droite pour dupliquer ce dépôt sur votre compte ;
2. Dans votre Fork, allez dans **Settings → Features et cochez Issues**, puis, sur la **page Actions, cliquez sur le bouton vert pour activer les workflows** ;
3. Revenez sur la page de personnalisation, à l'étape ④ choisissez **Mon propre Fork** et saisissez votre nom d'utilisateur GitHub ; les builds soumis ensuite s'exécuteront sur votre propre quota gratuit ;
4. La page télécharge `build-request.json` puis ouvre un formulaire Issue avec une seule pièce jointe obligatoire. Après son envoi, Actions utilise directement le `.config` complet inclus et ne le reconstruit pas depuis le base config du dépôt.

## Je suis mainteneur : comment ajouter des plugins / modifier la configuration

Flux de données : `config/<marque>/<modèle>/*.config` reste disponible pour importer d’anciennes configurations et traiter les requêtes historiques (le 360T7 compte actuellement 14 configurations source/branche/Profile). Les nouveaux paramètres de compilation proviennent dynamiquement de `WeiG-OpenWrt-Menuconfig-Catalog` ; chaque compilation Issue utilise comme entrée finale le `.config` complet exporté dans `build-request.json`.

### Ajouter une option de plugin

1. Vérifiez que les quatre base config contiennent déjà la ligne `# CONFIG_PACKAGE_luci-app-xxx is not set` pour ce paquet (si elle est absente, c'est que le paquet n'existe pas dans les feeds de cette source ; il faut d'abord ajouter le feed dans le script diy et mettre à jour la base config) ;
2. Ajoutez une entrée au tableau `plugins` de `tools/plugins-meta.json` : `{ "id": "xxx", "name": "nom chinois", "group": "groupe", "desc": "description en une phrase", "size": 2, "hot": false }` (si le nom du paquet diffère du suffixe `luci-app-` ou varie selon les trois sources, ajoutez un champ `pkgs` pour un mappage explicite ; s'il existe des plugins prérequis au niveau luci-app, ajoutez `requires: ["id-du-prérequis"]` et la page les cochera automatiquement en cascade) ;
3. Exécutez `node tools/gen-plugins.mjs` : le script régénère `site/wrt/data/360t7/plugins.json`, conserve les configurations de base faisant autorité uniquement sous `config/` et signale les plugins « présents dans la config mais non répertoriés » ;
4. Commitez et poussez (push). Aucune modification de code n'est nécessaire côté page : la nouvelle option apparaît automatiquement.

### Activer / ajouter un modèle de routeur

Le catalogue des modèles se trouve dans `site/wrt/data/devices.json`, organisé par marque ; le 360T7 est en maintenance complète, tous les autres modèles sont en **mode graine** (`sources` générées à partir d'un gabarit, table de plugins graine partagée, garantie limitée au démarrage). Étapes pour promouvoir un modèle graine au rang de maintenance complète :

1. Trouvez le modèle dans `devices.json` et complétez `sources` selon la situation réelle (pour chaque source : nom du fichier config, branches versions, variantes variants et paires de remplacement de partition) ;
2. Placez les configurations base de chaque source dans `config/<marque>/<id-modèle>/`, avec la convention de nommage `<marque>_<modèle>_<source>.config` (le dépôt a déjà généré, pour la plupart des modèles, une configuration graine « minimale capable de démarrer » — cible + LuCI uniquement — utilisable telle quelle ou comme base à enrichir) ;
3. Exécutez `node tools/gen-plugins.mjs` (il génère un plugins.json propre à chaque modèle activé) ;
4. Test de fumée : lancez une compilation cloud pour chaque source afin de confirmer qu'une image en sort bien.

Aucune modification du code de la page ni du workflow : le paramètre `device` reste validé par liste blanche comme d'habitude.

### Structure des répertoires et architecture technique

Voir [ARCHITECTURE.md](../ARCHITECTURE.md) (bilingue chinois-anglais).

### Sécurité

- Les Issues acceptent 1 à 3 pièces jointes hébergées par GitHub et détectent `build-request.json`, `.config` et `config.buildinfo` ; champs, listes autorisées, taille, signature cible et options obligatoires de la source sont validés. La configuration complète fait autorité par défaut ; `make defconfig` ne s’exécute qu’une fois si Defconfig est explicitement activé, avec contrôle de Target, Profile, architecture et paquets requis.
- L'identifiant de build (tag) est assaini pour ne conserver que caractères chinois, lettres, chiffres et traits d'union, et n'est utilisé que pour le nommage et l'affichage des artifacts ;
- Les permissions du workflow sont restreintes à `contents: read + issues: write`.

### Convention de maintenance multilingue de la documentation

**À chaque modification de ce README (ou de tout fichier md destiné aux utilisateurs), les versions linguistiques correspondantes sous `translations/` doivent être mises à jour en même temps** ; il en va de même pour la documentation développeur (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). C'est une règle stricte, destinée à empêcher toute dérive entre les versions linguistiques.

## Remerciements

Merci à tous les projets open source et à leurs auteurs qui ont contribué, directement ou indirectement, à ce projet :

- **Sources** : [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Infrastructure** : [GitHub Actions](https://github.com/features/actions) (compilation cloud) · [Cloudflare Pages](https://pages.cloudflare.com/) (hébergement du site de secours)
- **Tous les auteurs des <!--plugin-count-->242<!--/plugin-count--> plugins LuCI**, ainsi que les projets de l'écosystème tels que LuCI, Hexo et le thème Butterfly ;
- Chaque utilisateur qui soumet une Issue, signale un problème ou met une Star.

Ce projet se contente d'orchestrer et d'appeler les projets ci-dessus ; les droits d'auteur appartiennent à leurs auteurs respectifs.
