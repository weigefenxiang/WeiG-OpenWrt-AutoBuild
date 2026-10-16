# Wei.G OpenWrt — sesuaikan firmware secara online

Pilih perangkat dan paket di browser, kirim permintaan melalui GitHub, lalu biarkan sistem cloud mengompilasi firmware OpenWrt Anda.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Ramah ponsel · 🌙 Tema terang dan gelap · ✅ Mendukung berbagai turunan OpenWrt**

**[🌐 Buka halaman kustomisasi](https://www.weigshare.com/wrt/) · [⬇️ Unduh firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Distribusi yang didukung:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Bahasa:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Bahasa lainnya</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; **Bahasa Indonesia** &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Pratinjau antarmuka

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Mulai dalam tiga langkah

**📖 [Panduan lengkap bergambar](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Pilih sumber, perangkat, dan paket

Buka [**【Halaman kustomisasi】**](https://www.weigshare.com/wrt/) lalu pilih **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Centang paket yang diperlukan dan sesuaikan **【Advanced menuconfig】**, zona waktu, serta tema bila perlu. Untuk memakai pengaturan lama, klik **【Muat konfigurasi】** dan impor `build-request.json`, `.config`, atau `config.buildinfo`. Periksa kembali pilihan sebelum melanjutkan.

### 2. Kirim permintaan build melalui GitHub

[**【Masuk ke GitHub】**](https://github.com/login) terlebih dahulu. Kembali ke [**【Halaman kustomisasi】**](https://www.weigshare.com/wrt/) dan pilih **【Kirim build cloud】** → **【Unduh permintaan dan buka GitHub】**. Browser mengunduh berkas `*.json` dan membuka formulir GitHub Issue. Di komputer, seret JSON ke kolom permintaan, lalu klik **【Submit new issue】**. Bot akan membalas Issue dengan tautan ke proses build.

<details>
<summary><strong>Catatan penting (klik untuk membuka)</strong></summary>

> Gunakan **【Uji】** pada bilah mengambang di kanan bawah untuk memeriksa konfigurasi dan saran kompatibilitas lebih awal. Pemeriksaan yang sama berjalan otomatis saat permintaan dibuat.
>
> Jika ditemukan masalah, terapkan perbaikan yang disarankan atau pilih **【Pertahankan dan tetap lanjutkan】**. Memaksa proses berlanjut tidak memperbaiki bug pada kode sumber upstream dan build tetap dapat gagal.
>
> Gunakan halaman GitHub Issue yang dibuka otomatis oleh kustomisasi agar informasi yang sudah terisi tidak hilang.
>
> Mengunduh berkas JSON saja **tidak memulai build**. Anda harus mengirim Issue.
>
> Jangan bagikan kata sandi asli, token, atau rahasia lain di Issue publik, permintaan build, maupun log.

</details>

### 3. Unduh firmware

Ikuti tautan pada Issue atau buka [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Setelah berhasil, unduh firmware dari **【Artifacts】** di bagian bawah halaman. `CONFIG` berisi pengaturan dan `BUILD-LOGS` berisi log diagnostik — **keduanya bukan citra firmware untuk dipasang**. Berkas tersedia selama **60 hari**.

## Pertanyaan yang sering diajukan

<details>
<summary>Mengapa RootFS kehabisan ruang saat paket terlalu banyak?</summary>

Paket beserta dependensinya dapat melebihi ukuran partisi RootFS. Jika perangkat mendukung, cari `TARGET_ROOTFS_PARTSIZE` di **【Advanced menuconfig】** → **【Target Images】** dan sesuaikan, misalnya 512 atau 1024 MiB. Sebagian router fisik memiliki memori flash dan partisi tetap; kurangi paket untuk perangkat seperti itu. Lihat [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Mengapa build berhenti karena batas waktu?</summary>

Satu Job pada GitHub-hosted Runner biasanya dibatasi enam jam. Proyek ini menggunakan batas **350 menit**, dengan tenggat eksekusi **335 menit** untuk menyisakan waktu pengumpulan log. Proses **berhenti, bukan dijeda untuk dilanjutkan nanti**. Dependensi besar seperti Node.js atau Rust dapat memperlambat build.

</details>

<details>
<summary>Bagaimana menyelidiki build yang gagal?</summary>

Unduh `BUILD-LOGS` dari **【Artifacts】** dan baca `00-SUMMARY.txt` terlebih dahulu. Periksa kapasitas RootFS, waktu, serta kesalahan sumber atau dependensi. Lihat juga [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). Setelah mengubah pengaturan, buat **Issue baru**.

</details>

<details>
<summary>Bolehkah menjalankan ulang Run lama setelah mengganti konfigurasi?</summary>

Tidak untuk menguji pengaturan baru. Run lama tetap memakai permintaan, kode, dan data yang disematkan sebelumnya. Muat ulang konfigurasi pada situs saat ini dan kirim permintaan baru.

</details>

## Pengembangan dan penerapan

Pengguna biasa tidak perlu mengkloning repositori atau memasang Node.js. Detail teknis tersedia dalam bahasa Inggris di [panduan pengembang](../docs/DEVELOPER.md) dan [dokumentasi arsitektur](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) mengumpulkan dan menerbitkan cabang sumber, profil perangkat, paket, dependensi Kconfig, dan data kompatibilitas. Situs dan proses build menggunakan data yang sama tanpa memelihara basis data perangkat dan paket kedua.

## Ucapan terima kasih

Terima kasih kepada [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [serta seluruh penulis paket dan kontributor](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lisensi

Proyek ini dilisensikan menurut [GNU GPLv3 atau versi yang lebih baru](../LICENSE). Lihat [NOTICE](../NOTICE) untuk hak cipta dan kontak.
