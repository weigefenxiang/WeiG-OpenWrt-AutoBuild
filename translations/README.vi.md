# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · Tiếng Việt

**Tùy chỉnh trực tuyến + biên dịch trên đám mây** firmware OpenWrt. Chọn mã nguồn, chọn phiên bản, tích chọn plugin ngay trên trang web, GitHub Actions tự động biên dịch, firmware miễn phí tự tải về.

Hiện tại **360T7 (MT7981)** là thiết bị được bảo trì đầy đủ; hơn 200 thiết bị còn lại trên trang được mở ở **chế độ hạt giống** (chỉ đảm bảo ở mức "khởi động được", chưa được kiểm chứng trên máy thật, rủi ro tự chịu; cách nâng lên diện bảo trì đầy đủ xem ở phần dành cho người bảo trì bên dưới).

⭐ **Star là sự ủng hộ lớn nhất của bạn, Star của bạn chính là động lực để tôi tiếp tục cập nhật!**

- Trang tùy chỉnh (trang chính): <https://wrt.weigefenxiang.cc.cd>
- Trang tùy chỉnh (bản sao dự phòng trên blog): <https://www.weigeshare.cc.cd/wrt/>
- Ba dòng mã nguồn: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt chính thức](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Nhánh phiên bản**: lập chỉ mục toàn bộ nhánh từ xa của ImmortalWrt. OpenWrt gồm `main` và mọi nhánh `openwrt-*`, loại trừ `lede-17.01`, `pcs-standalone-back` và `master`. Trang tạo cấu hình riêng theo nguồn, nhánh và Profile thiết bị, chỉ hiển thị tổ hợp thực sự tồn tại ở upstream.
- Giao diện hỗ trợ **11 ngôn ngữ** (Trung giản thể / Trung phồn thể / Anh / Nga / Tây Ban Nha / Bồ Đào Nha / Nhật / Hàn / Đức / Pháp / Việt), tự động theo ngôn ngữ trình duyệt, có thể chuyển thủ công ở góc trên bên phải; khi thiếu bản dịch sẽ tự động quay về tiếng Anh

---

## Tôi là người dùng: cách tùy chỉnh firmware

1. Mở trang, lần lượt chọn **Source → Branch → Target System → Subtarget → Target Profile → plugin**, rồi nhập mã định danh bản dựng.
2. Nhấn **Gửi bản dựng đám mây → Tải yêu cầu và mở GitHub**. Chỉ tải lên `build-request.json` vừa được tạo rồi nhấn **Create**; không phải nhập thiết bị, nguồn, phiên bản hay phân vùng. Với `.config` hoặc `config.buildinfo` có sẵn, hãy nạp vào trang trước để nhận diện thiết bị.
3. Bot sẽ trả lời trong issue kèm liên kết của bản dựng lần này, biên dịch trọn bộ mất khoảng **2~3 giờ**.
4. Khi bản dựng hoàn tất, bot sẽ bình luận thông báo; mở trang bản dựng và tải xuống ở mục **Artifacts** cuối trang:
   - `thời-gian-tên-gốc.img.gz`: từng ảnh cuối được tải trực tiếp, không bọc ZIP; lần flash đầu thường dùng `factory`;
   - `thời-gian-CONFIG`: cấu hình đã gửi/thực tế và siêu dữ liệu;
   - `thời-gian-BUILD-LOGS`: log đầy đủ và lỗi, giữ 14 ngày;
   - `thời-gian-OPTIONAL-PACKAGES` / `thời-gian-FIRMWARE-OTHER`: gói M và tài liệu phụ.
5. Nếu không cần biên dịch, chọn **Gửi bản dựng đám mây → Chỉ tải .config**. Actions chỉ chạy `make defconfig` khi người dùng chủ động bật **Defconfig**; nếu không, `.config` đầy đủ vẫn là đầu vào có thẩm quyền. Tùy chọn bắt buộc chỉ được áp dụng sau khi xác nhận.
6. Trang nạp được `build-request.json`, `.config` và `config.buildinfo`. Trường múi giờ tìm kiếm toàn bộ danh sách IANA của OpenWrt/LuCI theo định dạng thống nhất `(UTC±HH:MM) Region/City`; đồng thời có thể chọn giao diện LuCI, NTP và máy chủ opkg.

> 💡 Sau khi flash firmware xong: dùng trình duyệt truy cập **192.168.1.1** (hoặc địa chỉ bạn đã tùy chỉnh ở trang gửi), tên đăng nhập **root**; **mật khẩu để trống** (lần đăng nhập đầu tiên hãy đặt mật khẩu ngay) — riêng nguồn Lean LEDE có mật khẩu ban đầu là `password`.
>
> 💡 Góc trên bên phải trang có nút **Tự kiểm tra**: một lần nhấn để kiểm tra khả năng truy cập của nguồn dữ liệu (ba cấp cục bộ / jsDelivr / raw), logic sinh .config và kết nối GitHub; khi trang tải bất thường hãy nhấn nút này trước để chẩn đoán.
>
> 💡 Khi tích chọn plugin có phụ thuộc (ví dụ trợ lý phân luồng MWAN3), các plugin tiền đề sẽ tự động được tích chọn giúp bạn; các phụ thuộc mức kernel / thư viện sẽ được tự động bổ sung khi biên dịch, không cần bận tâm.
>
> ⚠️ Tải Artifacts bắt buộc phải đăng nhập GitHub. Firmware, cấu hình và thông tin build được giữ 30 ngày; `BUILD-LOGS` được giữ 14 ngày.
>
> ⚠️ Flash firmware có rủi ro. Biến thể **phân vùng lớn 108M** yêu cầu bạn đã flash sẵn U-Boot "bất tử" (ubootmod); biến thể **phân vùng nguyên bản của hãng** flash trực tiếp không cần sửa phân vùng, nhưng dung lượng nhỏ, tích chọn quá nhiều plugin sẽ khiến biên dịch thất bại hoặc không đủ chỗ cài.

### Tìm firmware của mình trong Actions

Danh sách bản dựng được đặt tên theo dạng `Build 定制 · 你的标识 · 源码 版本/变体`, chỉ cần nhận đúng mã định danh bạn đã điền: kho mã → **Actions** → **custom-build**.

## Tự dựng bằng Fork

Nếu không muốn xếp hàng ở kho công cộng, hoặc muốn thay đổi cấu hình mặc định, bạn có thể hoàn toàn tự phục vụ:

1. Nhấn **Fork** ở góc trên bên phải để sao chép kho này về tài khoản của bạn;
2. Vào Fork của bạn, tại **Settings → Features tích chọn Issues**, sau đó vào **trang Actions nhấn nút màu xanh lá để bật workflows**;
3. Quay lại trang tùy chỉnh, ở bước ④ chọn **Fork của riêng tôi** và điền tên người dùng GitHub của bạn, các bản dựng gửi sau đó sẽ chạy trên hạn mức miễn phí của chính bạn;
4. Trang tải `build-request.json` rồi mở biểu mẫu Issue chỉ có một tệp đính kèm bắt buộc. Sau khi gửi, Actions dùng trực tiếp `.config` đầy đủ bên trong và không tạo lại từ base config của kho.

## Tôi là người bảo trì: cách thêm plugin / sửa cấu hình

Luồng dữ liệu: `config/<thương hiệu>/<mẫu máy>/*.config` được giữ lại để nạp cấu hình cũ và tương thích yêu cầu lịch sử (360T7 hiện có 14 cấu hình nguồn/nhánh/Profile). Tham số biên dịch mới được lấy động từ `WeiG-OpenWrt-Menuconfig-Catalog`; mỗi bản dựng qua Issue dùng `.config` đầy đủ được xuất trong `build-request.json` làm đầu vào cuối cùng.

### Thêm một tùy chọn plugin

1. Xác nhận cả bốn bản base config đã có dòng `# CONFIG_PACKAGE_luci-app-xxx is not set` của gói đó (nếu chưa có nghĩa là feeds của nguồn đó không có gói này, cần thêm feed vào script diy trước rồi cập nhật base config);
2. Thêm một mục vào mảng `plugins` trong `tools/plugins-meta.json`: `{ "id": "xxx", "name": "tên tiếng Trung", "group": "nhóm", "desc": "mô tả một câu", "size": 2, "hot": false }` (khi tên gói khác với hậu tố `luci-app-` hoặc ba nguồn đặt tên khác nhau, thêm trường `pkgs` để ánh xạ tường minh; khi có plugin tiền đề ở tầng luci-app, thêm `requires: ["id-tiền-đề"]`, trang sẽ tự động tích chọn liên động);
3. Chạy `node tools/gen-plugins.mjs`, script sẽ sinh lại `site/wrt/data/360t7/plugins.json`, chỉ giữ base config chuẩn trong `config/`, đồng thời cảnh báo về các plugin "có trong cấu hình nhưng chưa được thu nhận";
4. Commit và push. Trang web không cần sửa bất kỳ dòng code nào, tùy chọn mới sẽ tự động xuất hiện.

### Bật / thêm một mẫu router

Danh mục thiết bị nằm ở `site/wrt/data/devices.json`, tổ chức theo thương hiệu; 360T7 thuộc diện bảo trì đầy đủ, các thiết bị còn lại ở **chế độ hạt giống** (sources được sinh từ template, dùng chung bảng plugin hạt giống, chỉ đảm bảo khởi động được). Các bước nâng một thiết bị hạt giống lên diện bảo trì đầy đủ:

1. Tìm thiết bị đó trong `devices.json`, bổ sung `sources` theo tình hình thực tế (tên file config của từng nguồn, nhánh versions, biến thể variants cùng cặp thay thế phân vùng);
2. Đặt cấu hình base của từng nguồn vào `config/<thương hiệu>/<id mẫu máy>/`, quy tắc đặt tên `<thương hiệu>_<mẫu máy>_<nguồn>.config` (kho đã sinh sẵn cấu hình hạt giống "tối giản nhất mà vẫn khởi động được" cho phần lớn thiết bị, chỉ gồm thiết bị đích + LuCI, có thể dùng ngay hoặc bổ sung thêm trên nền đó);
3. Chạy `node tools/gen-plugins.mjs` (sẽ sinh plugins.json riêng cho từng thiết bị được bật);
4. Smoke test: chạy biên dịch đám mây một lần cho mỗi nguồn để xác nhận tạo ra được firmware.

Code của trang web và workflow không cần thay đổi gì, tham số `device` vẫn được kiểm tra theo danh sách trắng như thường lệ.

### Cấu trúc thư mục và kiến trúc kỹ thuật

Xem [ARCHITECTURE.md](../ARCHITECTURE.md) (song ngữ Trung - Anh).

### Bảo mật

- Issue nhận 1–3 tệp đính kèm do GitHub lưu trữ và tự nhận dạng `build-request.json`, `.config`, `config.buildinfo`; trường dữ liệu, danh sách cho phép, kích thước, chữ ký đích và tùy chọn bắt buộc đều được kiểm tra. Cấu hình đầy đủ là đầu vào chính thức theo mặc định. Chỉ khi Defconfig được bật rõ ràng, `make defconfig` chính thức mới chạy một lần; kết quả được dùng mà không có phép so sánh Target, Profile hoặc kiến trúc trước/sau riêng của dự án.
- Mã định danh bản dựng (tag) sẽ được làm sạch, chỉ giữ lại chữ Trung, chữ Latinh, chữ số và dấu gạch nối, chỉ dùng để đặt tên artifact và hiển thị;
- Quyền của workflow được thu hẹp còn `contents: read + issues: write`.

### Quy ước bảo trì tài liệu đa ngôn ngữ

**Mỗi lần sửa README này (hoặc bất kỳ file md nào hướng tới người dùng), bắt buộc phải cập nhật đồng bộ phiên bản ngôn ngữ tương ứng trong `translations/`**; tài liệu dành cho nhà phát triển cũng vậy (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). Đây là quy tắc cứng nhằm tránh các phiên bản ngôn ngữ bị lệch nhau.

## Lời cảm ơn

Cảm ơn tất cả các dự án mã nguồn mở và các tác giả đã đóng góp trực tiếp hoặc gián tiếp cho dự án này:

- **Mã nguồn**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Hạ tầng**: [GitHub Actions](https://github.com/features/actions) (biên dịch đám mây) · [Cloudflare Pages](https://pages.cloudflare.com/) (lưu trữ trang dự phòng)
- **Toàn bộ tác giả của <!--plugin-count-->242<!--/plugin-count--> plugin LuCI**, cùng các dự án hệ sinh thái như LuCI, Hexo, theme Butterfly;
- Mỗi người dùng đã gửi issue, phản hồi vấn đề và nhấn Star.

Dự án này chỉ điều phối và gọi tới các dự án nêu trên, bản quyền thuộc về các tác giả tương ứng.
