# Wei.G OpenWrt — çevrimiçi özel yazılım derleme

Aygıtınızı ve paketleri tarayıcıda seçin, isteği GitHub üzerinden gönderin; OpenWrt aygıt yazılımı bulutta derlensin.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Telefonlara uyumlu · 🌙 Açık ve koyu tema · ✅ Çeşitli OpenWrt tabanlı dağıtımlar**

**[🌐 Özelleştiriciyi aç](https://www.weigshare.com/wrt/) · [⬇️ Aygıt yazılımını indir](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Desteklenen dağıtımlar:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Dil:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 Diğer diller</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; **Türkçe** &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## Arayüz önizlemesi

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## Başlangıç: üç adımda aygıt yazılımı

**📖 [Görsellerle ayrıntılı kullanım kılavuzu](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Kaynağı, aygıtı ve paketleri seçin

[**【Çevrimiçi özelleştiriciyi】**](https://www.weigshare.com/wrt/) açın. Sırasıyla **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** seçeneklerini belirleyin. Gerekli paketleri seçip **【Advanced menuconfig】**, saat dilimi ve tema ayarlarını düzenleyin. Önceden kaydettiğiniz `build-request.json`, `.config` veya `config.buildinfo` dosyasını **【Yapılandırma yükle】** ile içe aktarabilir, ardından seçimlerinizi denetleyebilirsiniz.

### 2. GitHub üzerinden bulut derlemesi isteyin

Önce [**【GitHub hesabınızda oturum açın】**](https://github.com/login). [**【Özelleştiriciye】**](https://www.weigshare.com/wrt/) dönün ve **【Bulut derlemesi gönder】** → **【İsteği indir ve GitHub’ı aç】** seçeneklerini tıklayın. `*.json` dosyası indirilir ve GitHub Issue formu açılır. Bilgisayarda JSON dosyasını istek alanına sürükleyip **【Submit new issue】** düğmesine basın. Bot, derleme bağlantısıyla yanıt verir.

<details>
<summary><strong>Önemli notlar (açmak için tıklayın)</strong></summary>

> Sağ alt köşedeki yüzen araç çubuğunda **【Test】** seçeneğiyle yapılandırma ve uyumluluk önerilerini önceden denetleyebilirsiniz. İstek oluşturulurken bu kontroller otomatik olarak da yapılır.
>
> Sorun bulunursa önerilen düzeltmeyi uygulayın ya da **【Koru ve zorla devam et】** seçeneğini kullanın. Zorla devam etmek kaynak koddaki hataları gidermez ve derleme yine başarısız olabilir.
>
> Önceden doldurulan bilgilerin kaybolmaması için özelleştiricinin açtığı GitHub Issue sayfasını kullanın.
>
> JSON dosyasını indirmek tek başına **derlemeyi başlatmaz**. Issue gönderilmelidir.
>
> Gerçek parolaları, erişim belirteçlerini veya gizli bilgileri herkese açık Issues, istekler ve günlüklerde paylaşmayın.

</details>

### 3. Aygıt yazılımını indirin

Issue içindeki bağlantıyı açın veya [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) üzerinden derlemeyi bulun. İşlem tamamlanınca sayfanın altındaki **【Artifacts】** bölümünden aygıt yazılımını indirin. `CONFIG` yapılandırma, `BUILD-LOGS` tanılama günlükleridir; **ikisi de cihaza yazılacak firmware görüntüsü değildir**. Dosyalar **60 gün** saklanır.

## Sık sorulan sorular

<details>
<summary>Çok fazla paket seçince RootFS neden doluyor?</summary>

Paketler ve bağımlılıkları RootFS bölümüne sığmayabilir. Aygıt destekliyorsa **【Advanced menuconfig】** → **【Target Images】** altında `TARGET_ROOTFS_PARTSIZE` değerini örneğin 512 veya 1024 MiB olarak ayarlayın. Bazı fiziksel yönlendiricilerde flash belleği ve bölüm düzeni buna izin vermez; bu durumda paketleri azaltın. Örnekler: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>Derleme neden zaman aşımına uğruyor?</summary>

GitHub-hosted Runner üzerinde tek Job için normal sınır altı saattir. Bu projede Job sınırı **350 dakika**, günlükleri toplamaya zaman kalması için yürütme sınırı **335 dakikadır**. İşlem **durur; daha sonra devam etmek üzere duraklatılmaz**. Node.js ve Rust gibi büyük bağımlılıklar süreyi artırabilir.

</details>

<details>
<summary>Başarısız bir derlemeyi nasıl incelerim?</summary>

**【Artifacts】** bölümünden `BUILD-LOGS` dosyasını indirin, önce `00-SUMMARY.txt` dosyasını okuyun. RootFS kapasitesini, süreyi, kaynak ve bağımlılık hatalarını denetleyin. [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) örneklerine bakın. Düzeltmeden sonra **yeni Issue** oluşturun.

</details>

<details>
<summary>Ayarları değiştirdikten sonra eski Run’ı yeniden çalıştırabilir miyim?</summary>

Yeni ayarları sınamak için hayır. Eski Run ilk istekle sabitlenen kod ve verileri kullanır. Güncellenen ayarları sitede tekrar yükleyip yeni bir istek gönderin.

</details>

## Geliştirme ve dağıtım

Site üzerinden derleme yapmak için depoyu klonlamanız veya Node.js yüklemeniz gerekmez. Teknik bilgiler İngilizce [geliştirici kılavuzunda](../docs/DEVELOPER.md) ve [mimari belgede](ARCHITECTURE/ARCHITECTURE.md) bulunur.

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog), kaynak dallarını, aygıt profillerini, paketleri, Kconfig bağımlılıklarını ve uyumluluk verilerini yayımlar. Site ve derleme işlemi aynı verileri kullanır; AutoBuild içinde ikinci bir aygıt/paket veritabanı tutulmaz.

## Teşekkürler

Teşekkürler: [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [ve tüm paket yazarları ile katkıda bulunanlar](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## Lisans

Bu proje [GNU GPLv3 veya sonraki sürümler](../LICENSE) altında lisanslanmıştır. Telif hakkı ve iletişim: [NOTICE](../NOTICE).
