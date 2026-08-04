# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**言語 / Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (Brasil)](README.pt.md) · 日本語 · [한국어](README.ko.md) · [Deutsch (Sie)](README.de.md) · [Français (vous)](README.fr.md) · [Tiếng Việt](README.vi.md)

OpenWrt ファームウェアの**オンラインカスタマイズ + クラウドビルド**。Web ページ上でソースコードとバージョンを選び、プラグインにチェックを入れるだけで、GitHub Actions が自動的にビルドし、ファームウェアを無料で入手できます。

現在、**360T7(MT7981)** が完全メンテナンス対象機種です。ページ上のその他 200 台以上の機種は**シードモード**で開放されています(「起動できる」レベルの保証のみで、実機での検証は行っていません。自己責任でご利用ください。完全メンテナンス対象へ昇格させる方法は、下記のメンテナー向けの章を参照してください)。

⭐ **Star こそが最大の応援です。あなたの Star が更新の原動力になります!**

- カスタマイズページ(メインサイト):<https://wrt.weigefenxiang.cc.cd>
- カスタマイズページ(ブログ上の予備ミラー):<https://www.weigeshare.cc.cd/wrt/>
- 3 つのソースコード系統:[ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt 公式](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **バージョンブランチ**:ImmortalWrt の全リモートブランチを収録します。OpenWrt は `main` と全 `openwrt-*` ブランチを収録し、`lede-17.01`、`pcs-standalone-back`、`master` を除外します。ページはソース・ブランチ・デバイス Profile ごとに個別設定を生成し、上流に実在する組み合わせだけを表示します。
- UI は **11 言語**に対応(簡体字中国語/繁体字中国語/英語/ロシア語/スペイン語/ポルトガル語/日本語/韓国語/ドイツ語/フランス語/ベトナム語)。ブラウザの言語に自動追従し、右上から手動で切り替えられます。訳文がない場合は自動的に英語へフォールバックします

---

## ユーザー向け:ファームウェアのカスタマイズ方法

1. ページを開き、**Source → Branch → Target System → Subtarget → Target Profile → プラグイン** の順に選び、ビルド識別子を入力します。
2. **クラウドビルドを送信 → リクエストをダウンロードして GitHub を開く** を押します。ダウンロードされた `build-request.json` だけをアップロードして **Create** を押してください。機種・ソース・バージョン・パーティションの入力は不要です。既存の `.config` または `config.buildinfo` は、先にウェブページで読み込んで機種を識別してください。
3. ボットが Issue 内に今回のビルドへのリンクを返信します。フルビルドには約 **2〜3 時間**かかります。
4. ビルド完了後、ボットがコメントで通知します。ビルドページを開き、下部の **Artifacts** からダウンロードしてください:
   - `時刻-元ファイル名.img.gz`:各最終イメージを ZIP なしで直接取得します。初回は通常 `factory` を使います;
   - `時刻-CONFIG`:送信/実効設定とメタデータ;
   - `時刻-BUILD-LOGS`:完全なログとエラー。14日間保持されます;
   - `時刻-OPTIONAL-PACKAGES` / `時刻-FIRMWARE-OTHER`:M パッケージと補助資料。
5. ビルドしない場合は **クラウドビルドを送信 → .config のみダウンロード** を選びます。Actions はユーザーが **Defconfig** を明示的に有効化した場合のみ `make defconfig` を実行し、それ以外では完全な `.config` を正本として扱います。必須項目は確認後だけ適用されます。
6. `build-request.json`、`.config`、`config.buildinfo` を読み込めます。時刻帯は OpenWrt/LuCI の完全な IANA リストを検索でき、`(UTC±HH:MM) Region/City` 形式で統一表示されます。LuCI テーマ、NTP、opkg ミラーも選択できます。

> 💡 ファームウェア書き込み後:ブラウザで **192.168.1.1**(または送信ページでカスタマイズしたアドレス)にアクセスします。ユーザー名は **root**、**パスワードは空**です(初回ログイン時にすぐ設定してください)。Lean LEDE ソースのみ、初期パスワードは `password` です。
>
> 💡 ページ右上に **セルフチェック** ボタンがあります:データソースの到達性(ローカル/jsDelivr/raw の 3 段階)、.config 生成ロジック、GitHub への接続性をワンクリックで検査できます。読み込みに異常があるときは、まずこれを押して原因を調べてください。
>
> 💡 依存関係のあるプラグイン(例:MWAN3 負荷分散アシスタント)にチェックを入れると、前提プラグインも自動的にチェックされます。カーネル/ライブラリレベルの依存はビルド時に自動補完されるので、気にする必要はありません。
>
> ⚠️ Artifacts のダウンロードには GitHub へのログインが必要です。ファームウェア、設定、ビルド情報は 30 日間、`BUILD-LOGS` は 14 日間保持されます。
>
> ⚠️ ファームウェアの書き込みにはリスクがあります。**108M 大容量パーティション**バリアントは、ブリック耐性のある U-Boot(ubootmod)を事前に書き込み済みであることが前提です。**純正パーティション**バリアントはパーティション変更なしでそのまま書き込めますが、容量が小さいため、プラグインを多く選ぶとビルドに失敗したり、収まらなかったりします。

### Actions で自分のファームウェアを見つける

ビルド一覧は `Build 定制 · 你的标识 · 源码 版本/变体` の形式で命名されます。自分が入力した識別子を目印にしてください:リポジトリ → **Actions** → **custom-build**。

## Fork してセルフビルド

公共リポジトリで順番待ちしたくない場合や、デフォルト設定を変更したい場合は、完全にセルフサービスで運用できます:

1. 右上の **Fork** をクリックして、本リポジトリを自分のアカウントに複製します。
2. 自分の Fork で **Settings → Features の Issues にチェック**を入れ、さらに **Actions ページで緑のボタンをクリックして workflows を有効化**します。
3. カスタマイズページに戻り、手順 ④ で **自分の Fork** を選択して自分の GitHub ユーザー名を入力すると、以降に送信するビルドは自分の無料枠で実行されます。
4. ページは `build-request.json` をダウンロードし、必須添付欄が1つだけの Issue フォームを開きます。そのファイルを送信すれば、Actions は中の完全な `.config` を直接使用し、リポジトリの base config から再生成しません。

## メンテナー向け:プラグインの追加 / 設定の変更方法

データフロー:`config/<ブランド>/<機種>/*.config` は旧設定の読み込みと過去のリクエストとの互換性のために保持します(360T7 は現在、ソース/ブランチ/Profile の組み合わせが 14 件)。新しいビルドパラメータは `WeiG-OpenWrt-Menuconfig-Catalog` から動的に取得し、Issue ビルドは `build-request.json` に書き出された完全な `.config` を最終入力として使用します。

### プラグイン項目を追加する

1. 4 つの base config に、そのパッケージの `# CONFIG_PACKAGE_luci-app-xxx is not set` 行がすでに存在することを確認します(なければ、そのソースの feeds にこのパッケージが存在しないということなので、先に diy スクリプトで feed を追加し、base config を更新する必要があります)。
2. `tools/plugins-meta.json` の `plugins` 配列にエントリを 1 件追加します:`{ "id": "xxx", "name": "中文名", "group": "分组", "desc": "一句话说明", "size": 2, "hot": false }`(パッケージ名が `luci-app-` + サフィックスの形式と異なる場合や、3 ソース間で名前が異なる場合は `pkgs` フィールドで明示的にマッピングします。luci-app 層の前提プラグインがある場合は `requires: ["前置id"]` を追加すると、ページ上で自動的に連動してチェックされます)。
3. `node tools/gen-plugins.mjs` を実行します。スクリプトが `site/wrt/data/360t7/plugins.json` を再生成して base config のコピーを同期し、あわせて「設定には存在するが未収録」のプラグインについて警告を出します。
4. コミットして push します。ページ側のコードは一切変更不要で、新しい項目が自動的に表示されます。

### ルーター機種を有効化/追加する

機種カタログは `site/wrt/data/devices.json` にあり、ブランド別に整理されています。360T7 は完全メンテナンス対象で、その他の機種は**シードモード**です(sources はテンプレートから生成され、共通のシードプラグイン表を使用し、「起動できる」ことのみを保証)。シード機種 1 台を完全メンテナンス対象へ昇格させる手順:

1. `devices.json` で対象機種を見つけて、実際の状況に合わせて `sources` を補完します(各ソースの config ファイル名、versions ブランチ、variants バリアントとパーティション置換ペア)。
2. `config/<ブランド>/<機種id>/` に各ソースの base 設定を配置します。命名規則は `<ブランド>_<機種>_<ソース>.config` です(リポジトリには大半の機種向けに「起動できる最小構成」のシード設定がすでに生成されており、対象機種 + LuCI のみを含みます。そのまま使うことも、これをベースに追加していくこともできます)。
3. `node tools/gen-plugins.mjs` を実行します(有効化された機種ごとに、それぞれの plugins.json が生成されます)。
4. スモークテスト:各ソースで 1 回ずつクラウドビルドを実行し、イメージが生成できることを確認します。

ページと workflow のコードは一切変更不要で、`device` パラメータは従来どおりホワイトリストで検証されます。

### ディレクトリ構成と技術アーキテクチャ

[ARCHITECTURE.md](../ARCHITECTURE.md)(中国語・英語の 2 言語)を参照してください。

### セキュリティ

- Issue は GitHub 上の添付を1～3個受け付け、`build-request.json`、`.config`、`config.buildinfo` を自動判定します。完全設定を既定の正本とし、Defconfig を明示的に有効化した場合だけ `make defconfig` を1回実行して Target、Profile、アーキテクチャ、必須パッケージを保護検証します。
- ビルド識別子(tag)は中国語・英数字とハイフンのみにサニタイズされ、artifact の命名と表示にのみ使用されます。
- workflow の権限は `contents: read + issues: write` に絞り込まれています。

### ドキュメントの多言語メンテナンス規約

**本 README(またはユーザー向けのあらゆる md)を変更するたびに、`translations/` 配下の対応する言語版を必ず同時に更新してください**。開発者ドキュメントも同様です(`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`)。これは各言語版の乖離を防ぐための厳格なルールです。

## 謝辞

本プロジェクトに直接・間接に貢献してくださったすべてのオープンソースプロジェクトと作者に感謝します:

- **ソースコード**:[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **インフラストラクチャ**:[GitHub Actions](https://github.com/features/actions)(クラウドビルド)· [Cloudflare Pages](https://pages.cloudflare.com/)(予備サイトのホスティング)
- **<!--plugin-count-->242<!--/plugin-count--> 個の LuCI プラグインのすべての作者**、および LuCI、Hexo、Butterfly テーマなどのエコシステムプロジェクト。
- Issue を送信し、問題を報告し、Star を付けてくださったすべてのユーザーの皆さん。

本プロジェクトは上記プロジェクトをオーケストレーションして呼び出しているに過ぎず、著作権は各作者に帰属します。
