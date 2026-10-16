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
[Asturianu](README.ast.md) &lrm;·&lrm; **Azərbaycanca** &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
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
