# Wei.G OpenWrt — firmware-ის მორგება ონლაინ

ბრაუზერში აირჩიეთ მოწყობილობა და პაკეტები, გააგზავნეთ მოთხოვნა GitHub-ზე და OpenWrt firmware ღრუბელში აიწყობა.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 მობილურზე მოსახერხებელი · 🌙 ღია და მუქი თემა · ✅ OpenWrt-ის სხვადასხვა ვარიანტი**

**[🌐 კონფიგურატორის გახსნა](https://www.weigshare.com/wrt/) · [⬇️ firmware-ის ჩამოტვირთვა](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**მხარდაჭერილი სისტემები:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**ენა:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 სხვა ენები</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; **ქართული** &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## ინტერფეისის გადახედვა

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## დაწყება: firmware სამ ნაბიჯში

**📖 [სრული ილუსტრირებული სახელმძღვანელო](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. წყაროს, მოწყობილობისა და პაკეტების არჩევა

გახსენით [**【ონლაინ კონფიგურატორი】**](https://www.weigshare.com/wrt/) და აირჩიეთ **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. მონიშნეთ საჭირო პაკეტები და საჭიროებისას შეცვალეთ **【Advanced menuconfig】**, დროის სარტყელი და თემა. **【კონფიგურაციის ჩატვირთვა】** საშუალებას გაძლევთ შეიტანოთ `build-request.json`, `.config` ან `config.buildinfo`. გაგრძელებამდე გადაამოწმეთ არჩევანი.

### 2. GitHub-ზე ღრუბლოვანი აწყობის მოთხოვნის გაგზავნა

ჯერ [**【შედით GitHub-ში】**](https://github.com/login), შემდეგ დაუბრუნდით [**【კონფიგურატორს】**](https://www.weigshare.com/wrt/) და დააჭირეთ **【ღრუბლოვანი აწყობის გაგზავნა】** → **【მოთხოვნის ჩამოტვირთვა და GitHub-ის გახსნა】**. ჩამოიტვირთება `*.json` და გაიხსნება GitHub Issue-ის ფორმა. კომპიუტერზე გადაიტანეთ JSON მოთხოვნის ველში და დააჭირეთ **【Submit new issue】**. ბოტი გიპასუხებთ აწყობის ბმულით.

<details>
<summary><strong>მნიშვნელოვანი შენიშვნები (გაშლა)</strong></summary>

> ქვედა მარჯვენა კუთხის მოძრავი ზოლის **【შემოწმება】** ღილაკით წინასწარ შეამოწმეთ კონფიგურაცია და თავსებადობა. მოთხოვნის შექმნისას იგივე შემოწმება ავტომატურად ხდება.
>
> პრობლემის შემთხვევაში გამოიყენეთ რეკომენდებული გამოსწორება ან აირჩიეთ **【შენარჩუნება და იძულებით გაგრძელება】**. ეს არ ასწორებს საწყის კოდში შეცდომებს და აწყობა შეიძლება ვერ დასრულდეს.
>
> გამოიყენეთ კონფიგურატორის მიერ ავტომატურად გახსნილი GitHub Issue-ის ფორმა, რათა შევსებული ინფორმაცია არ დაიკარგოს.
>
> მხოლოდ JSON ფაილის ჩამოტვირთვა **აწყობას არ იწყებს**; Issue უნდა გაგზავნოთ.
>
> არ გამოაქვეყნოთ ნამდვილი პაროლები, ტოკენები ან სხვა საიდუმლოებები საჯარო Issues-ში ან ჟურნალებში.

</details>

### 3. firmware-ის ჩამოტვირთვა

მიჰყევით Issue-ის ბმულს ან გახსენით [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). წარმატებით დასრულების შემდეგ ჩამოტვირთეთ firmware **【Artifacts】** განყოფილებიდან. `CONFIG` შეიცავს პარამეტრებს, `BUILD-LOGS` — დიაგნოსტიკურ ჟურნალებს; **ეს ფაილები ჩასაწერი firmware არ არის**. ფაილები ხელმისაწვდომია **60 დღე**.

## ხშირად დასმული კითხვები

<details>
<summary>რატომ არ ჰყოფნის RootFS-ს ადგილი ბევრი პაკეტისას?</summary>

პაკეტებმა და დამოკიდებულებებმა შეიძლება გადააჭარბონ RootFS დანაყოფის ზომას. თუ მოწყობილობა იძლევა საშუალებას, **【Advanced menuconfig】** → **【Target Images】** განყოფილებაში შეცვალეთ `TARGET_ROOTFS_PARTSIZE`, მაგალითად 512 ან 1024 MiB-მდე. ზოგი რეალური როუტერის flash დანაყოფი უცვლელია; შეამცირეთ პაკეტების რაოდენობა. იხილეთ [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>რატომ ჩერდება ხანგრძლივი აწყობა?</summary>

GitHub-hosted Runner-ზე ერთ Job-ს ჩვეულებრივ ექვსსაათიანი ლიმიტი აქვს. ამ პროექტში ზღვარია **350 წუთი**, ხოლო შესრულება **335 წუთზე** წყდება ჟურნალების შესაგროვებლად. ეს **შეწყვეტაა და არა მოგვიანებით გასაგრძელებელი პაუზა**.

</details>

<details>
<summary>როგორ გავარკვიო წარუმატებელი აწყობის მიზეზი?</summary>

**【Artifacts】** განყოფილებიდან ჩამოტვირთეთ `BUILD-LOGS` და ჯერ წაიკითხეთ `00-SUMMARY.txt`. შეამოწმეთ RootFS, დროის ლიმიტი, კოდის და დამოკიდებულებების შეცდომები. იხილეთ [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). გამოსწორების შემდეგ გახსენით **ახალი Issue**.

</details>

<details>
<summary>შეიძლება ძველი Run-ის გაშვება ახალი პარამეტრებით?</summary>

არა. ძველი Run ძველ მოთხოვნასა და ფიქსირებულ კოდსა და მონაცემებს იყენებს. მიმდინარე კონფიგურატორში გადაამოწმეთ ახალი პარამეტრები და ახალი მოთხოვნა გაგზავნეთ.

</details>

## განვითარება და გაშვება

საიტის გამოსაყენებლად საცავის კლონირება ან Node.js-ის დაყენება საჭირო არ არის. ინგლისურად ხელმისაწვდომია [დეველოპერის გზამკვლევი](../docs/DEVELOPER.md) და [არქიტექტურის აღწერა](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) აქვეყნებს წყაროს განშტოებებს, მოწყობილობის პროფილებს, პაკეტებს, Kconfig დამოკიდებულებებსა და თავსებადობის მონაცემებს.

## მადლობა

მადლობა [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [და ყველა პაკეტის ავტორსა და მონაწილეს](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## ლიცენზია

პროექტი ვრცელდება [GNU GPLv3 ან უფრო ახალი](../LICENSE) ლიცენზიით. საავტორო უფლებები და კონტაქტი: [NOTICE](../NOTICE).
