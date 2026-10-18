# Wei.G OpenWrt — Tùy chỉnh firmware trực tuyến

Chọn thiết bị và gói phần mềm ngay trên trình duyệt, gửi yêu cầu qua GitHub, rồi để hệ thống đám mây biên dịch firmware OpenWrt cho bạn.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Tương thích điện thoại · 🌙 Giao diện sáng và tối · ✅ Hỗ trợ nhiều bản phân phối dựa trên OpenWrt**

**[🌐 Mở trang tùy chỉnh](https://www.weigshare.com/wrt/) · [⬇️ Tải firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Các bản phân phối được hỗ trợ:** [<img src="../docs/images/sources/immortalwrt.svg" alt="ImmortalWrt" align="absmiddle">](https://github.com/immortalwrt/immortalwrt) · [<img src="../docs/images/sources/lede.svg" alt="Lean LEDE" align="absmiddle">](https://github.com/coolsnowwolf/lede) · [<img src="../docs/images/sources/openwrt.svg" alt="OpenWrt" align="absmiddle">](https://github.com/openwrt/openwrt) · [<img src="../docs/images/sources/istoreos.svg" alt="iStoreOS" align="absmiddle">](https://github.com/istoreos/istoreos) · [<img src="../docs/images/sources/lienol.svg" alt="Lienol" align="absmiddle">](https://github.com/Lienol/openwrt) · [<img src="../docs/images/sources/hanwckf.svg" alt="ImmortalWrt (hanwckf MT798x)" align="absmiddle">](https://github.com/hanwckf/immortalwrt-mt798x)

**Ngôn ngữ:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Tiếng Việt**

<details>
<summary><b>🔤 Ngôn ngữ khác</b></summary>

<div dir="ltr">
<a href="README.ast.md">Asturianu</a> &lrm;·&lrm; <a href="README.az.md">Azərbaycanca</a> &lrm;·&lrm; <a href="README.be.md">Беларуская</a> &lrm;·&lrm; <a href="README.bg.md">Български</a> &lrm;·&lrm; <a href="README.bn.md">বাংলা</a> &lrm;·&lrm; <a href="README.bn-BD.md">বাংলা (বাংলাদেশ)</a> &lrm;·&lrm; <a href="README.ca.md">Català</a> &lrm;·&lrm; <a href="README.cs.md">Čeština</a> &lrm;·&lrm; <a href="README.da.md">Dansk</a> &lrm;·&lrm; <a href="README.el.md">Ελληνικά</a> &lrm;·&lrm; <a href="README.fi.md">Suomi</a> &lrm;·&lrm; <a href="README.fil.md">Filipino</a> &lrm;·&lrm; <a href="README.ga.md">Gaeilge</a> &lrm;·&lrm; <a href="README.hi.md">हिन्दी</a> &lrm;·&lrm; <a href="README.hu.md">Magyar</a> &lrm;·&lrm; <a href="README.id.md">Bahasa Indonesia</a> &lrm;·&lrm; <a href="README.it.md">Italiano</a> &lrm;·&lrm; <a href="README.ka.md">ქართული</a> &lrm;·&lrm; <a href="README.lo.md">ລາວ</a> &lrm;·&lrm; <a href="README.lt.md">Lietuvių</a> &lrm;·&lrm; <a href="README.lv.md">Latviešu</a> &lrm;·&lrm; <a href="README.ml.md">മലയാളം</a> &lrm;·&lrm; <a href="README.mr.md">मराठी</a> &lrm;·&lrm; <a href="README.ms.md">Bahasa Melayu</a> &lrm;·&lrm; <a href="README.nb-NO.md">Norsk bokmål</a> &lrm;·&lrm; <a href="README.nl.md">Nederlands</a> &lrm;·&lrm; <a href="README.pl.md">Polski</a> &lrm;·&lrm; <a href="README.pt-BR.md">Português (Brasil)</a> &lrm;·&lrm; <a href="README.ro.md">Română</a> &lrm;·&lrm; <a href="README.sk.md">Slovenčina</a> &lrm;·&lrm; <a href="README.sv.md">Svenska</a> &lrm;·&lrm; <a href="README.ta.md">தமிழ்</a> &lrm;·&lrm; <a href="README.tr.md">Türkçe</a> &lrm;·&lrm; <a href="README.uk.md">Українська</a> &lrm;·&lrm; <a href="README.yua.md">Màaya t'aan (English)</a> &lrm;·&lrm; <a href="README.ar.md">&#x2067;العربية&#x2069;</a> &lrm;·&lrm; <a href="README.fa.md">&#x2067;فارسی&#x2069;</a> &lrm;·&lrm; <a href="README.he.md">&#x2067;עברית&#x2069;</a> &lrm;·&lrm; <a href="README.ur.md">&#x2067;اردو&#x2069;</a>
</div>

</details>

## Xem trước giao diện

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt giao diện máy tính" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt giao diện điện thoại" width="21.30%">
</p>

## Bắt đầu: tạo firmware qua ba bước

**📖 [Hướng dẫn chi tiết kèm hình ảnh](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Chọn mã nguồn, thiết bị và gói phần mềm

Mở [**【Trang tùy chỉnh】**](https://www.weigshare.com/wrt/), rồi lần lượt chọn **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Đánh dấu chức năng cần thiết tại **【② Chọn plugin】** và tùy chỉnh **【Advanced menuconfig】**, múi giờ hoặc giao diện nếu muốn.

Nếu đã có cấu hình, nhấn **【Nạp cấu hình】** để nhập tệp cấu hình `*.json`, `.config` hoặc `config.buildinfo`. Hãy kiểm tra lại mã nguồn, thiết bị và gói trước khi tiếp tục.

### 2. Gửi yêu cầu biên dịch qua GitHub

Trước tiên, [**【đăng nhập GitHub】**](https://github.com/login). Quay lại [**【Trang tùy chỉnh】**](https://www.weigshare.com/wrt/), chọn **【Gửi yêu cầu biên dịch đám mây】** → **【Tải cấu hình và mở GitHub】**. Trình duyệt sẽ tải tệp `*.json` và mở biểu mẫu GitHub Issue. Trên máy tính, kéo tệp JSON vừa tải vào ô yêu cầu, sau đó nhấn **【Submit new issue】**.

Sau khi gửi Issue, bot sẽ trả lời bằng liên kết tới lượt biên dịch.

<details>
<summary><strong>Lưu ý quan trọng (nhấn để mở)</strong></summary>

> **Mẹo:** Có thể nhấn **【Kiểm tra】** trên thanh công cụ nổi ở góc dưới bên phải để xem lỗi cấu hình và gợi ý tương thích. Khi chọn **【Tải cấu hình và mở GitHub】**, hệ thống cũng tự động kiểm tra.
>
> Nếu phát hiện vấn đề, hãy áp dụng cách khắc phục được đề xuất hoặc chọn **【Giữ nguyên và buộc tiếp tục】**. Việc buộc tiếp tục không sửa lỗi mã nguồn phía thượng nguồn và quá trình biên dịch vẫn có thể thất bại.
>
> Chỉ nên dùng biểu mẫu GitHub Issue được mở tự động từ trang tùy chỉnh để không mất thông tin điền sẵn.
>
> Chỉ tải JSON mà chưa gửi Issue thì **không bắt đầu biên dịch**.
>
> Đừng công khai mật khẩu thật, mã thông báo hoặc dữ liệu nhạy cảm trong Issue, yêu cầu hay nhật ký.

</details>

### 3. Tải firmware

Theo liên kết trong Issue hoặc tìm lượt chạy tại [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Khi hoàn tất, tải firmware ở mục **【Artifacts】** phía cuối trang. `CONFIG` là tệp cấu hình, `BUILD-LOGS` là nhật ký chẩn đoán; **không được dùng chúng để nạp firmware**. Các tệp tải xuống được giữ trong **60 ngày**.

## Câu hỏi thường gặp

<details>
<summary>Vì sao chọn nhiều gói khiến RootFS thiếu dung lượng?</summary>

Các gói và phần phụ thuộc có thể vượt quá kích thước phân vùng RootFS. Nếu thiết bị hỗ trợ, mở **【Advanced menuconfig】** → **【Target Images】** để tìm `TARGET_ROOTFS_PARTSIZE`, rồi điều chỉnh theo nhu cầu, chẳng hạn 512 hoặc 1024 MiB. Nhiều bộ định tuyến vật lý không cho phép sửa do giới hạn bộ nhớ flash và sơ đồ phân vùng; khi đó hãy bớt gói. Tham khảo [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Vì sao quá trình biên dịch bị hết thời gian?</summary>

Một tác vụ trên máy chạy do GitHub cung cấp thường có giới hạn sáu giờ. Dự án đặt giới hạn tác vụ **350 phút**, với hạn chót thực thi **335 phút** để dành thời gian thu thập nhật ký. Đến hạn, quá trình **dừng hẳn, không tạm dừng để tiếp tục sau**. Các gói lớn như Node.js hoặc Rust có thể làm thời gian tăng lên.

</details>

<details>
<summary>Cần làm gì khi biên dịch thất bại?</summary>

Tải `BUILD-LOGS` từ **【Artifacts】** và xem `00-SUMMARY.txt` trước. Sau đó xác định vấn đề đến từ dung lượng RootFS, thời gian, mã nguồn hay xung đột phụ thuộc. Xem thêm [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Khi đã sửa cấu hình, hãy tạo **Issue mới**.

</details>

<details>
<summary>Có thể chạy lại Run cũ sau khi đổi cấu hình không?</summary>

Không thể dùng Run cũ để kiểm tra thay đổi mới: nó vẫn dùng yêu cầu, mã nguồn và dữ liệu được chốt trước đó. Hãy tải lại cấu hình trên trang hiện tại, kiểm tra và gửi Issue mới.

</details>

## Phát triển và triển khai

Người dùng thông thường không cần nhân bản kho mã hay cài Node.js. Thông tin kỹ thuật có trong [hướng dẫn dành cho nhà phát triển (tiếng Anh)](../docs/DEVELOPER.md) và [tài liệu kiến trúc (tiếng Anh)](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) thu thập và công bố các nhánh mã nguồn, hồ sơ thiết bị, gói phần mềm, quan hệ phụ thuộc Kconfig và dữ liệu tương thích. Trang web và bộ xây dựng cùng sử dụng nguồn dữ liệu này, không duy trì thêm cơ sở dữ liệu thiết bị và gói riêng trong AutoBuild.

## Lời cảm ơn

Cảm ơn [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) và [tất cả tác giả gói phần mềm cùng cộng đồng đóng góp](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Giấy phép

Dự án được phát hành theo [GNU GPLv3](../LICENSE) hoặc phiên bản mới hơn. Xem bản quyền và thông tin liên hệ tại [NOTICE](../NOTICE).
