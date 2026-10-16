# Wei.G OpenWrt — firmware-i onlayn fərdiləşdirin

Brauzerdə cihazı və paketləri seçin, GitHub üzərindən sorğu göndərin, OpenWrt firmware-inin yığılmasını bulud xidmətinə həvalə edin.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Mobil cihazlara uyğun · 🌙 Açıq və tünd mövzu · ✅ Müxtəlif OpenWrt variantları**

**[🌐 Konfiquratoru aç](https://www.weigshare.com/wrt/) · [⬇️ Firmware-i endir](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Dəstəklənən sistemlər:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Dil:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Digər dillər</b></summary>

<div dir="ltr">
<a href="README.ast.md">Asturianu</a> &lrm;·&lrm; <strong>Azərbaycanca</strong> &lrm;·&lrm; <a href="README.be.md">Беларуская</a> &lrm;·&lrm; <a href="README.bg.md">Български</a> &lrm;·&lrm; <a href="README.bn.md">বাংলা</a> &lrm;·&lrm; <a href="README.bn-BD.md">বাংলা (বাংলাদেশ)</a> &lrm;·&lrm; <a href="README.ca.md">Català</a> &lrm;·&lrm; <a href="README.cs.md">Čeština</a> &lrm;·&lrm; <a href="README.da.md">Dansk</a> &lrm;·&lrm; <a href="README.el.md">Ελληνικά</a> &lrm;·&lrm; <a href="README.fi.md">Suomi</a> &lrm;·&lrm; <a href="README.fil.md">Filipino</a> &lrm;·&lrm; <a href="README.ga.md">Gaeilge</a> &lrm;·&lrm; <a href="README.hi.md">हिन्दी</a> &lrm;·&lrm; <a href="README.hu.md">Magyar</a> &lrm;·&lrm; <a href="README.id.md">Bahasa Indonesia</a> &lrm;·&lrm; <a href="README.it.md">Italiano</a> &lrm;·&lrm; <a href="README.ka.md">ქართული</a> &lrm;·&lrm; <a href="README.lo.md">ລາວ</a> &lrm;·&lrm; <a href="README.lt.md">Lietuvių</a> &lrm;·&lrm; <a href="README.lv.md">Latviešu</a> &lrm;·&lrm; <a href="README.ml.md">മലയാളം</a> &lrm;·&lrm; <a href="README.mr.md">मराठी</a> &lrm;·&lrm; <a href="README.ms.md">Bahasa Melayu</a> &lrm;·&lrm; <a href="README.nb-NO.md">Norsk bokmål</a> &lrm;·&lrm; <a href="README.nl.md">Nederlands</a> &lrm;·&lrm; <a href="README.pl.md">Polski</a> &lrm;·&lrm; <a href="README.pt-BR.md">Português (Brasil)</a> &lrm;·&lrm; <a href="README.ro.md">Română</a> &lrm;·&lrm; <a href="README.sk.md">Slovenčina</a> &lrm;·&lrm; <a href="README.sv.md">Svenska</a> &lrm;·&lrm; <a href="README.ta.md">தமிழ்</a> &lrm;·&lrm; <a href="README.tr.md">Türkçe</a> &lrm;·&lrm; <a href="README.uk.md">Українська</a> &lrm;·&lrm; <a href="README.yua.md">Màaya t'aan</a> &lrm;·&lrm; <a href="README.ar.md">&#x2067;العربية&#x2069;</a> &lrm;·&lrm; <a href="README.fa.md">&#x2067;فارسی&#x2069;</a> &lrm;·&lrm; <a href="README.he.md">&#x2067;עברית&#x2069;</a> &lrm;·&lrm; <a href="README.ur.md">&#x2067;اردو&#x2069;</a>
</div>

</details>

## İnterfeysin önizləməsi

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Başlanğıc: üç addımda firmware

**📖 [Şəkilli ətraflı təlimat](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Mənbəni, cihazı və paketləri seçin

[**【Onlayn konfiquratoru】**](https://www.weigshare.com/wrt/) açın və **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** seçin. Lazım olan paketləri qeyd edin, sonra istəsəniz **【Advanced menuconfig】**, saat qurşağı və mövzunu dəyişin. Mövcud parametrləri **【Konfiqurasiyanı yüklə】** ilə `build-request.json`, `.config` və ya `config.buildinfo` faylından idxal edə bilərsiniz. Davam etməzdən əvvəl yoxlayın.

### 2. GitHub vasitəsilə bulud yığımı göndərin

Əvvəlcə [**【GitHub hesabınıza daxil olun】**](https://github.com/login), sonra [**【Konfiquratora】**](https://www.weigshare.com/wrt/) qayıdın. **【Bulud yığımını göndər】** → **【Sorğunu endir və GitHub-u aç】** düymələrini seçin. Brauzer `*.json` yükləyib GitHub Issue formasını açacaq. Kompüterdə JSON faylını sorğu sahəsinə sürüşdürün və **【Submit new issue】** düyməsinə basın. Bot yığımın keçidini cavab olaraq verəcək.

<details>
<summary><strong>Vacib qeydlər (aç)</strong></summary>

> Sağ aşağı küncdəki üzən alətlər panelində **【Yoxla】** ilə konfiqurasiya və uyğunluğu əvvəlcədən yoxlayın. Sorğu yaradılarkən yoxlama avtomatik aparılır.
>
> Problem olarsa, təklif olunan düzəlişi tətbiq edin və ya **【Saxla və məcburi davam et】** seçin. Bu, mənbə kodundakı xətaları düzəltmir və yığım uğursuz ola bilər.
>
> Əvvəlcədən doldurulmuş məlumatı itirməmək üçün konfiquratorun açdığı GitHub Issue formasından istifadə edin.
>
> Sadəcə JSON-u endirmək **yığımı başlatmır**; Issue göndərilməlidir.
>
> Parol, token və digər məxfi məlumatları açıq Issues, sorğular və loqlarda paylaşmayın.

</details>

### 3. Firmware-i endirin

Issue-dəki keçidi izləyin və ya [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) bölməsini açın. Uğurla bitdikdən sonra **【Artifacts】** bölməsindən firmware-i endirin. `CONFIG` parametrləri, `BUILD-LOGS` diaqnostika loqlarını saxlayır; **onlar cihaza yazıla bilən firmware faylı deyil**. Fayllar **60 gün** saxlanılır.

## Tez-tez verilən suallar

<details>
<summary>Çox paket seçəndə RootFS niyə dolur?</summary>

Paketlər və asılılıqlar RootFS bölməsindən böyük ola bilər. Cihaz dəstəkləyirsə, **【Advanced menuconfig】** → **【Target Images】** daxilində `TARGET_ROOTFS_PARTSIZE` dəyərini, məsələn, 512 və ya 1024 MiB edin. Fiziki routerlərin bəzisində flash bölmələri dəyişmir; paketləri azaldın. Baxın: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Uzun yığım niyə dayanır?</summary>

GitHub-hosted Runner-də bir Job üçün adətən altı saat limit var. Bu layihədə limit **350 dəqiqə**, icra müddəti isə loqlar üçün **335 dəqiqədir**. Yığım **dayanır, sonra bərpa etmək üçün fasiləyə qoyulmur**.

</details>

<details>
<summary>Uğursuz yığımın səbəbini necə tapım?</summary>

**【Artifacts】** bölməsindən `BUILD-LOGS` endirib əvvəlcə `00-SUMMARY.txt` oxuyun. RootFS, vaxt limiti, mənbə kodu və asılılıqları yoxlayın. [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) nümunələrinə baxın. Düzəlişdən sonra **yeni Issue** açın.

</details>

<details>
<summary>Yeni parametrlərlə köhnə Run-u yenidən başladım?</summary>

Xeyr. Köhnə Run əvvəlki sorğu, kod və məlumat versiyalarından istifadə edir. Yenilənmiş konfiqurasiyanı yoxlayıb yeni sorğu göndərin.

</details>

## İnkişaf və yerləşdirmə

Saytdan istifadə üçün repozitoriyanı klonlamaq və Node.js quraşdırmaq lazım deyil. İngilis dilində [tərtibatçı bələdçisi](../docs/DEVELOPER.md) və [arxitektura sənədi](ARCHITECTURE/ARCHITECTURE.md) mövcuddur.

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) mənbə budaqları, cihaz profilləri, paketlər, Kconfig asılılıqları və uyğunluq məlumatlarını dərc edir.

## Təşəkkürlər

Təşəkkür edirik [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [və bütün paket müəlliflərinə və iştirakçılara](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lisenziya

Layihə [GNU GPLv3 və ya yenisi](../LICENSE) ilə yayımlanır. Müəllif hüquqları və əlaqə: [NOTICE](../NOTICE).
