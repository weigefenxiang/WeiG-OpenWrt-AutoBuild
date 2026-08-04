# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**語言 / Language**:[简](../README.md) · 繁 · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

OpenWrt 韌體**線上客製 + 雲端編譯**。在網頁上選原始碼、選版本、勾套件,GitHub Actions 自動編譯,韌體免費自取。

目前 **360T7(MT7981)** 為完整維護機型;頁面裡其餘 200+ 台機型以**種子模式**開放(僅保證「能開機」等級、未經實機驗證,風險自負;升級為完整維護檔的方法見下文維護者章節)。

⭐ **Star 就是對我最大的支持,你的 Star 就是我持續更新的動力!**

- 客製頁面(主站):<https://wrt.weigefenxiang.cc.cd>
- 客製頁面(部落格備援副本):<https://www.weigeshare.cc.cd/wrt/>
- 三條原始碼產線:[ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt 官方](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **版本分支**:ImmortalWrt 收錄全部遠端分支;OpenWrt 收錄 `main` 與全部 `openwrt-*` 分支,排除 `lede-17.01`、`pcs-standalone-back`、`master`。頁面依「原始碼＋分支＋裝置 Profile」產生獨立設定,只顯示上游真實存在的組合。
- 介面支援 **11 種語言**(簡中/繁中/英/俄/西/葡/日/韓/德/法/越),自動跟隨瀏覽器語言,右上角可手動切換;譯文缺漏時自動改以英文顯示

---

## 我是使用者:怎麼客製韌體

1. 打開客製頁面，依序選擇 **Source → Branch → Target System → Subtarget → Target Profile → 套件**，再填寫建置識別名稱。
2. 點選 **送出雲端編譯 → 下載請求並開啟 GitHub**，在跳轉頁面只需上傳剛下載的 `build-request.json`，再點 **Create**；不必填寫機型、原始碼、版本或分割區參數（需登入 GitHub）。現有 `.config` 或 `config.buildinfo` 請先在網頁點「載入設定」，識別機型後再送出。
3. 機器人會在 issue 裡回覆本次建置的連結,整機編譯約 **2~3 小時**。
4. 建置完成後機器人會回覆通知,打開建置頁面,在底部 **Artifacts** 下載:
   - `時間戳-原檔名.img.gz`:每個最終映像獨立下載，不套 ZIP；首次刷機通常選擇含 `factory` 的檔案；
   - `時間戳-CONFIG`:送出/實際開編設定與中繼資料；
   - `時間戳-BUILD-LOGS`:完整日誌與錯誤摘要，保留 14 天；
   - `時間戳-OPTIONAL-PACKAGES` / `時間戳-FIRMWARE-OTHER`:M 套件與輔助資料。
5. 若不需要編譯，可點 **送出雲端編譯 → 僅下載 .config**。只有使用者主動勾選 **Defconfig** 時，Actions 才執行 `make defconfig`；未勾選時完整 `.config` 保持權威輸入。必需設定只會在明確確認後套用。
6. 頁面可載入 `build-request.json`、`.config`、`config.buildinfo`；時區提供 OpenWrt/LuCI 完整 IANA 清單並支援搜尋，統一顯示為 `(UTC±HH:MM) Region/City`。也可選擇韌體 LuCI 主題、NTP 與 opkg 鏡像，確認框會再次列出品牌、型號、原始碼、版本、分割區與網頁版本。

> 💡 刷好韌體後:瀏覽器連到 **192.168.1.1**(或你在提交頁自訂的位址),使用者名稱 **root**;**密碼為空**(首次登入請立即設定)——只有 Lean LEDE 來源的初始密碼是 `password`。
>
> 💡 頁面右上角有 **自我檢測** 按鈕:一鍵檢測資料來源可達性(本機/jsDelivr/raw 三層)、.config 產生邏輯、GitHub 連線狀態,載入異常時先點它檢查。
>
> 💡 勾選有相依性的套件(如 MWAN3 分流助手)會自動幫你勾上前置套件;核心/函式庫層級的相依性在編譯時會自動補齊,無需操心。
>
> ⚠️ 下載 Artifacts 必須登入 GitHub(GitHub 的限制)。韌體、設定與建置資訊保留 30 天,`BUILD-LOGS` 保留 14 天,過期請重新送出建置。
>
> ⚠️ 刷機有風險。**108M 大分割區**變體要求你已刷好不死 U-Boot(ubootmod);**原廠分割區**變體免改分割區直接刷,但空間小,套件勾多了會編譯失敗或裝不下。

### 在 Actions 裡找到自己的韌體

建置清單依 `Build 定制 · 你的标识 · 源码 版本/变体` 命名,認明自己填的識別名稱即可:儲存庫 → **Actions** → **custom-build**。

## Fork 自建

不想在公共儲存庫排隊,或想改預設設定,可以完全自助:

1. 點右上角 **Fork** 把本儲存庫複製到你的帳號;
2. 到你的 Fork 裡 **Settings → Features 勾選 Issues**,再到 **Actions 頁面按綠色按鈕啟用 workflows**;
3. 回到客製頁面,第 ④ 步選 **我自己的 Fork** 並填入你的 GitHub 使用者名稱,之後送出的建置就跑在你自己的免費額度裡;
4. 網頁會先下載 `build-request.json`，再開啟只有一個必填附件欄位的 Issue 表單；上傳該檔案並送出即可。Actions 直接採用檔案內完整的 `.config`，不會再由儲存庫 base config 重建。

## 我是維護者:怎麼加套件 / 改設定

資料流:`config/<品牌>/<機型>/*.config` 保留給舊設定匯入與歷史請求(360T7 目前有 14 份來源/分支/Profile 設定)。新的建置參數由 `WeiG-OpenWrt-Menuconfig-Catalog` 動態提供；每次 Issue 建置都以 `build-request.json` 匯出的完整 `.config` 為最終輸入。

### 新增一個套件選項

1. 確認四份 base config 裡已有該套件的 `# CONFIG_PACKAGE_luci-app-xxx is not set` 行(沒有的話,表示該來源的 feeds 裡沒有這個套件,需要先在 diy 腳本裡加 feed 並更新 base config);
2. 在 `tools/plugins-meta.json` 的 `plugins` 陣列裡加一條:`{ "id": "xxx", "name": "中文名", "group": "分组", "desc": "一句话说明", "size": 2, "hot": false }`(套件名與 `luci-app-` 後綴不同、或三個來源名稱不一致時,加 `pkgs` 欄位明確對應;有 luci-app 層前置套件時加 `requires: ["前置id"]`,頁面會自動連動勾選);
3. 跑 `node tools/gen-plugins.mjs`,腳本會重新產生 `site/wrt/data/360t7/plugins.json` 並同步 base config 副本,同時對「設定裡有但沒收錄」的套件發出警告;
4. 提交 push。頁面無需改任何程式碼,新選項自動出現。

### 開啟/新增一台路由器機型

機型目錄在 `site/wrt/data/devices.json`,依品牌組織;360T7 為完整維護檔,其餘機型為**種子模式**(sources 由範本產生、共用種子套件表、僅保證能開機)。把一台種子機型升級為完整維護檔的步驟:

1. 在 `devices.json` 找到該機型,依實際情況補齊 `sources`(每個來源的 config 檔名、versions 分支、variants 變體與分割區替換對);
2. 在 `config/<品牌>/<机型id>/` 放上各來源的 base 設定,命名規範為 `<品牌>_<机型>_<源>.config`(儲存庫已為大部分機型產生了「最精簡能開機」的種子設定,只含目標機型 + LuCI,可直接使用或在其上加料);
3. 跑 `node tools/gen-plugins.mjs`(會為每台啟用的機型產生各自的 plugins.json);
4. 冒煙測試:每個來源各跑一次雲端編譯,確認能產出映像檔。

頁面與 workflow 程式碼零改動,`device` 參數照常做白名單驗證。

### 目錄結構與技術架構

見 [ARCHITECTURE.md](../ARCHITECTURE.md)(中英雙語)。

### 安全

- Issue 接受 1~3 個 GitHub 自有附件並自動辨識 `build-request.json`、`.config`、`config.buildinfo`;欄位、白名單、大小、機型目標簽章與原始碼必需項都會驗證。完整設定預設為權威輸入；只有明確勾選 Defconfig 時才執行一次 `make defconfig`，並保護驗證 Target、Profile、架構與必需套件。
- 建置識別名稱(tag)會被清洗為中英文、數字與連字號,僅用於 artifact 命名與顯示;
- workflow 權限收斂為 `contents: read + issues: write`。

### 文件多語言維護約定

**每次修改本 README(或任何面向使用者的 md),必須同步更新 `translations/` 下對應語言版本**;開發者文件同理(`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`)。這是硬性規定,防止各語言版本漂移。

## 鳴謝

感謝所有為本專案直接或間接做出貢獻的開源專案與作者:

- **原始碼**:[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **基礎設施**:[GitHub Actions](https://github.com/features/actions)(雲端編譯)· [Cloudflare Pages](https://pages.cloudflare.com/)(備援站點託管)
- **<!--plugin-count-->242<!--/plugin-count--> 個 LuCI 套件的全部作者**,以及 LuCI、Hexo、Butterfly 主題等生態專案;
- 每一位建立 issue、回報問題、按下 Star 的使用者。

本專案僅對上述專案進行編排與呼叫,版權歸各自作者所有。
