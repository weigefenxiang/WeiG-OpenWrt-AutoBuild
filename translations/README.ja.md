# Wei.G OpenWrt ファームウェアのオンラインカスタマイズ

ブラウザーで機種とパッケージを選び、GitHub からビルドを依頼するだけ。OpenWrt ファームウェアをクラウド上で作成できます。

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 スマートフォン対応 · 🌙 ライト／ダークテーマ · ✅ さまざまな OpenWrt 系ソースに対応**

**[🌐 カスタマイズ画面を開く](https://www.weigshare.com/wrt/) · [⬇️ ファームウェアをダウンロード](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**対応ソース:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**言語:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · **日本語** · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 その他の言語</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## 画面プレビュー

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt デスクトップ画面" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt スマートフォン画面" width="21.30%">
</p>

## はじめての方へ：3 ステップでファームウェアを作成

**📖 [画像付きの詳しいガイド](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. ソース・機種・パッケージを選択

[**【オンラインカスタマイズ】**](https://www.weigshare.com/wrt/) を開き、**【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** の順に選択します。**【② パッケージを選択】** で必要な機能を選び、必要に応じて **【Advanced menuconfig】**、タイムゾーン、テーマなどを調整してください。

既存の設定を使う場合は **【設定を読み込む】** から `build-request.json`、`.config` または `config.buildinfo` をインポートします。ソース・機種・パッケージを確認してから進めてください。

### 2. GitHub にクラウドビルドを依頼

最初に [**【GitHub にログイン】**](https://github.com/login) してください。その後 [**【カスタマイズ画面】**](https://www.weigshare.com/wrt/) に戻り、**【クラウドビルドを送信】** → **【リクエストをダウンロードして GitHub を開く】** を押します。`*.json` ファイルが保存され、GitHub Issue の入力画面が開きます。パソコンでは保存した JSON をリクエスト欄へドラッグ＆ドロップし、**【Submit new issue】** をクリックします。

Issue の送信後、ボットがビルド実行ページへのリンクを返信します。

<details>
<summary><strong>注意事項（クリックして表示）</strong></summary>

> **ヒント:** 右下のフローティングツールバーにある **【検】** から設定上の問題や互換性に関する提案を事前に確認できます。**【リクエストをダウンロードして GitHub を開く】** の操作時にも自動チェックが行われます。
>
> 問題が検出された場合は推奨修正を適用するか、**【維持して強制的に続行】** を選べます。ただし上流ソースの不具合は解消されず、ビルドに失敗する可能性があります。
>
> 入力済み情報が失われないよう、カスタマイズ画面から自動的に開いた GitHub Issue ページを使用してください。
>
> JSON ファイルを保存しただけではビルドは始まりません。**Issue の送信が必要**です。
>
> 公開 Issue・ビルド依頼・ログに実際のパスワードやトークンなどの機密情報を書かないでください。

</details>

### 3. ファームウェアをダウンロード

Issue に返信されたリンク、または [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) から実行履歴を開きます。成功したらページ下部の **【Artifacts】** からファームウェアをダウンロードしてください。`CONFIG` は設定、`BUILD-LOGS` は診断ログであり、**いずれも書き込み用ファームウェアではありません**。保存期限は **60 日間**です。

## よくある質問

<details>
<summary>パッケージを増やすと RootFS の容量不足になるのはなぜですか？</summary>

パッケージと依存関係により、RootFS パーティションに収まらなくなることがあります。対応機種では **【Advanced menuconfig】** → **【Target Images】** の `TARGET_ROOTFS_PARTSIZE` を探し、必要に応じて 512 または 1024 MiB などに調整してください。一方、実機ルーターにはフラッシュ容量や領域構成の制約で変更できないものがあります。その場合はパッケージを減らしてください。事例：[Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)。

</details>

<details>
<summary>ビルドが時間切れで失敗するのはなぜですか？</summary>

GitHub が提供する Runner のジョブは通常最大 6 時間です。本プロジェクトでは **350 分**をジョブ上限とし、ログ収集のために実行を **335 分**で打ち切ります。これは**一時停止ではなく終了**であり、続きから再開できません。Node.js や Rust を含む大規模な依存関係は時間がかかります。

</details>

<details>
<summary>ビルド失敗時はどこを調べればよいですか？</summary>

実行ページの **【Artifacts】** から `BUILD-LOGS` を取得し、まず `00-SUMMARY.txt` を確認してください。RootFS の容量、時間制限、上流ソースや依存関係のエラーを切り分けます。[Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) も参考にしてください。設定を修正したら**新しい Issue**を作成します。

</details>

<details>
<summary>設定変更後に以前の Run を再実行してもよいですか？</summary>

いいえ。古い Run は当時のリクエストと固定されたコード・データを使います。現在の画面で設定を読み込み直して確認し、新しいリクエストと Issue を作成してください。

</details>

## 開発・デプロイ

通常の利用ではリポジトリのクローンや Node.js のインストールは不要です。技術的な詳細は [開発者ガイド（英語）](../docs/DEVELOPER.md) および [アーキテクチャ資料（英語）](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) は、ソースのブランチ、機種 Profile、パッケージ、Kconfig の依存関係、互換性情報を収集して公開します。サイトとクラウドビルドは同じ情報を使用するため、AutoBuild 側に別の機種・パッケージデータベースを持つ必要がありません。

## 謝辞

以下のプロジェクトに感謝します： [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) ならびに [すべてのパッケージ作者と貢献者](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## ライセンス

本プロジェクトは [GNU GPLv3](../LICENSE) 以降のバージョンで公開されています. 著作権・連絡先は [NOTICE](../NOTICE).
