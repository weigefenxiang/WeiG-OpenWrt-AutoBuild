# Wei.G OpenWrt 韌體線上客製化

在網頁上選擇裝置與套件，再透過 GitHub 提交建置需求，由雲端編譯專屬的 OpenWrt 韌體。

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 支援手機操作 · 🌙 淺色／深色主題 · ✅ 支援多種 OpenWrt 系統原始碼**

**[🌐 開啟線上客製化](https://www.weigshare.com/wrt/) · [⬇️ 下載韌體](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**支援:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**語言:** [English](../README.md) · [简中](README.zh-CN.md) · **繁中** · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 更多語言</b></summary>

<div dir="ltr">
Asturianu &lrm;·&lrm; Azərbaycanca &lrm;·&lrm; Беларуская &lrm;·&lrm; Български &lrm;·&lrm; বাংলা &lrm;·&lrm; বাংলা (বাংলাদেশ) &lrm;·&lrm; Català &lrm;·&lrm; Čeština &lrm;·&lrm; Dansk &lrm;·&lrm; Ελληνικά &lrm;·&lrm; Suomi &lrm;·&lrm; Filipino &lrm;·&lrm; Gaeilge &lrm;·&lrm; हिन्दी &lrm;·&lrm; Magyar &lrm;·&lrm; Bahasa Indonesia &lrm;·&lrm; Italiano &lrm;·&lrm; ქართული &lrm;·&lrm; ລາວ &lrm;·&lrm; Lietuvių &lrm;·&lrm; Latviešu &lrm;·&lrm; മലയാളം &lrm;·&lrm; मराठी &lrm;·&lrm; Bahasa Melayu &lrm;·&lrm; Norsk bokmål &lrm;·&lrm; Nederlands &lrm;·&lrm; Polski &lrm;·&lrm; Português (Brasil) &lrm;·&lrm; Română &lrm;·&lrm; Slovenčina &lrm;·&lrm; Svenska &lrm;·&lrm; தமிழ் &lrm;·&lrm; Türkçe &lrm;·&lrm; Українська &lrm;·&lrm; Màaya t'aan &lrm;·&lrm; &#x2067;العربية&#x2069; &lrm;·&lrm; &#x2067;فارسی&#x2069; &lrm;·&lrm; &#x2067;עברית&#x2069; &lrm;·&lrm; &#x2067;اردو&#x2069;
</div>

</details>

## 介面預覽

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt 電腦版介面" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt 手機版介面" width="21.30%">
</p>

## 新手入門：三個步驟完成韌體編譯

**📖 [完整圖文教學](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. 選擇原始碼、裝置與套件

開啟 [**【線上客製化頁面】**](https://www.weigshare.com/wrt/)，依序選擇 **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**。在 **【② 勾選套件】** 挑選所需功能，再視需求調整 **【Advanced menuconfig】**、時區與主題。

若已有設定，點選 **【載入設定】**，匯入 `build-request.json`、`.config` 或 `config.buildinfo`，確認原始碼、機型與套件選擇後繼續。

### 2. 透過 GitHub 提交雲端編譯需求

請先[**【登入 GitHub】**](https://github.com/login)，再回到[**【線上客製化頁面】**](https://www.weigshare.com/wrt/)，依序點選 **【提交雲端編譯】** → **【下載請求並開啟 GitHub】**。系統會下載 `*.json` 檔案並開啟 GitHub Issue 表單。使用電腦時，可將 JSON 檔拖曳至表單中的建置請求欄位，再按 **【Submit new issue】**。

Issue 送出後，機器人會回覆該次編譯工作的連結。

<details>
<summary><strong>注意事項（點擊展開）</strong></summary>

> **提醒:** 可以先透過網頁右下角浮動工具列的 **【檢】** 檢查設定與相容性建議；使用 **【下載請求並開啟 GitHub】** 也會自動進行預先檢查。
>
> 若偵測到問題，可以採用修正建議，或選擇 **【保留並強制繼續】**。強制繼續並不代表問題已解決；上游程式碼有錯誤時，編譯仍可能失敗。
>
> 請使用客製化頁面自動開啟的 GitHub Issue 表單，避免遺失預填的請求資訊。
>
> 只下載 JSON、卻沒有送出 Issue，**不會開始編譯**。
>
> 切勿在公開 Issue、建置請求或日誌中提供真正的密碼、權杖等機密資料。

</details>

### 3. 下載韌體

透過 Issue 中的連結，或前往 [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) 找到該次工作。成功後，從頁面底部的 **【Artifacts】** 下載韌體。`CONFIG` 是設定檔、`BUILD-LOGS` 是診斷日誌，**都不能當作韌體刷入裝置**。下載檔案保留 **60 天**，請及時備份。

## 常見問題

<details>
<summary>為什麼選太多套件會導致 RootFS 空間不足？</summary>

套件及其相依項目可能讓韌體超出 RootFS 分割區容量。如果裝置支援調整，可在 **【Advanced menuconfig】** → **【Target Images】** 尋找 `TARGET_ROOTFS_PARTSIZE`，視需求設定為 512 或 1024 MiB 等容量。部分實體路由器受快閃記憶體與分割區限制，無法修改此參數；應減少套件，而不是直接套用 x86 的設定。參考 [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)。

</details>

<details>
<summary>為什麼編譯會因為執行太久而失敗？</summary>

GitHub 託管的 Runner 單一 Job 通常以 6 小時為上限。本專案將 Job 設為 **350 分鐘**，並在 **335 分鐘** 停止執行編譯，以便預留收集日誌的時間。到達時限是**停止**，不是暫停、也無法稍後接續；大型套件可能需要更久。

</details>

<details>
<summary>編譯失敗時應該如何排查？</summary>

在該次 Run 底部的 **【Artifacts】** 下載 `BUILD-LOGS`，先查看 `00-SUMMARY.txt`，再根據錯誤判斷是 RootFS 容量、超時、上游程式碼或相依套件的問題。可參考 [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)。修改設定後請提交**新的 Issue**。

</details>

<details>
<summary>修改設定後可以重新執行舊 Run 嗎？</summary>

不建議。舊 Run 仍使用原先鎖定的設定、程式碼與資料；請在目前網頁重新載入、檢查設定並產生新請求，接著建立新 Issue。

</details>

## 開發與部署

一般使用者不必複製程式庫，也不必安裝 Node.js。開發者可參閱 [開發者指南（英文）](../docs/DEVELOPER.md) 與 [架構說明（英文）](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 收集並發布各個上游版本、裝置 Profile、套件、Kconfig 相依關係與相容性資料，供網頁與雲端編譯使用，避免 AutoBuild 重複維護另一套裝置與套件資料庫。

## 致謝

感謝 [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) 及 [所有套件作者與開源貢獻者](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## 授權條款

本專案採用 [GNU GPLv3](../LICENSE) 或更新版本授權. 著作權與聯絡資訊請見 [NOTICE](../NOTICE).
