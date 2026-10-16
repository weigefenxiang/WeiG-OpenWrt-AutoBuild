# Wei.G OpenWrt — فرم ویئر کی آن لائن تخصیص

براؤزر میں آلہ اور پیکج منتخب کریں، GitHub پر درخواست بھیجیں اور OpenWrt فرم ویئر کو کلاؤڈ میں مرتب ہونے دیں۔

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 موبائل کے لیے موزوں · 🌙 روشن اور تاریک تھیم · ✅ OpenWrt کی متعدد اقسام**

**[🌐 کنفیگریٹر کھولیں](https://www.weigshare.com/wrt/) · [⬇️ فرم ویئر ڈاؤن لوڈ کریں](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**معاونت یافتہ نظام:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**زبان:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 مزید زبانیں</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; **&#x2067;اردو&#x2069;**
</div>

</details>

## انٹرفیس کی جھلک

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## آغاز: تین مراحل میں فرم ویئر

**📖 [تصاویر کے ساتھ مکمل رہنما](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. ماخذ، آلہ اور پیکج منتخب کریں

[**【آن لائن کنفیگریٹر】**](https://www.weigshare.com/wrt/) کھول کر **【Source】** ← **【Branch】** ← **【Target System】** ← **【Subtarget】** ← **【Target Profile】** منتخب کریں۔ مطلوبہ پیکج نشان زد کریں اور ضرورت کے مطابق **【Advanced menuconfig】**، ٹائم زون اور تھیم تبدیل کریں۔ **【کنفیگریشن لوڈ کریں】** سے `build-request.json`، `.config` یا `config.buildinfo` درآمد کیا جا سکتا ہے۔ آگے بڑھنے سے پہلے انتخاب دیکھ لیں۔

### 2. GitHub کے ذریعے کلاؤڈ بلڈ کی درخواست دیں

پہلے [**【GitHub میں سائن ان کریں】**](https://github.com/login)، پھر [**【کنفیگریٹر】**](https://www.weigshare.com/wrt/) پر واپس جا کر **【کلاؤڈ بلڈ جمع کریں】** ← **【درخواست ڈاؤن لوڈ کریں اور GitHub کھولیں】** دبائیں۔ براؤزر `*.json` فائل حاصل کر کے GitHub Issue فارم کھولے گا۔ کمپیوٹر پر JSON درخواست کے خانے میں کھینچیں اور **【Submit new issue】** دبائیں۔ بوٹ بلڈ کا لنک جواب میں دے گا۔

<details>
<summary><strong>اہم ہدایات (کھولنے کے لیے دبائیں)</strong></summary>

> نیچے دائیں جانب تیرتی ٹول بار کے **【جانچ】** بٹن سے کنفیگریشن اور مطابقت پہلے دیکھ سکتے ہیں۔ درخواست بناتے وقت یہ جانچ خودکار بھی ہوتی ہے۔
>
> مسئلہ ملے تو تجویز کردہ حل اپنائیں یا **【برقرار رکھیں اور زبردستی جاری رکھیں】** منتخب کریں۔ یہ ماخذ کوڈ کی خرابی دور نہیں کرتا، اس لیے بلڈ ناکام ہو سکتی ہے۔
>
> پہلے سے بھری ہوئی معلومات محفوظ رکھنے کے لیے کنفیگریٹر سے خود کھلنے والا GitHub Issue فارم استعمال کریں۔
>
> صرف JSON ڈاؤن لوڈ کرنے سے **بلڈ شروع نہیں ہوتی**؛ Issue جمع کرانا ضروری ہے۔
>
> عوامی Issues، درخواستوں یا لاگز میں حقیقی پاس ورڈ، ٹوکن یا راز شائع نہ کریں۔

</details>

### 3. فرم ویئر ڈاؤن لوڈ کریں

Issue میں موجود لنک سے یا [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) سے بلڈ کھولیں۔ کامیابی کے بعد **【Artifacts】** سے فرم ویئر حاصل کریں۔ `CONFIG` ترتیبات اور `BUILD-LOGS` تشخیصی لاگز ہیں؛ **یہ فلیش کرنے والی فرم ویئر فائلیں نہیں**۔ فائلیں **60 دن** دستیاب رہتی ہیں۔

## اکثر پوچھے گئے سوالات

<details>
<summary>زیادہ پیکج سے RootFS کی جگہ کیوں کم پڑ جاتی ہے؟</summary>

پیکج اور ان کے انحصار RootFS پارٹیشن سے بڑے ہو سکتے ہیں۔ آلہ اجازت دے تو **【Advanced menuconfig】** ← **【Target Images】** میں `TARGET_ROOTFS_PARTSIZE` کو مثلاً 512 یا 1024 MiB کریں۔ بعض حقیقی راؤٹرز کی فلیش پارٹیشن مستقل ہوتی ہے؛ وہاں پیکج کم کریں۔ مثالیں: [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)۔

</details>

<details>
<summary>طویل بلڈ کیوں رک جاتی ہے؟</summary>

GitHub-hosted Runner کے ایک Job کی حد عموماً چھ گھنٹے ہے۔ منصوبے میں حد **350 منٹ** اور عمل درآمد **335 منٹ** رکھا گیا ہے تاکہ لاگز محفوظ ہو سکیں۔ **بلڈ بند ہوتی ہے، بعد میں دوبارہ شروع کرنے کے لیے معطل نہیں ہوتی**۔

</details>

<details>
<summary>ناکام بلڈ کی وجہ کیسے معلوم ہو؟</summary>

**【Artifacts】** سے `BUILD-LOGS` لیں اور پہلے `00-SUMMARY.txt` پڑھیں۔ RootFS، وقت، ماخذ کوڈ اور انحصار کی غلطیاں دیکھیں۔ [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) دیکھیں۔ تبدیلی کے بعد **نیا Issue** بنائیں۔

</details>

<details>
<summary>کیا نئی ترتیبات کے لیے پرانا Run دوبارہ چلا سکتے ہیں؟</summary>

نہیں۔ پرانا Run اصل درخواست اور پہلے سے مقررہ کوڈ و ڈیٹا استعمال کرتا ہے۔ نئی ترتیبات چیک کر کے نئی درخواست دیں۔

</details>

## ترقی اور تعیناتی

سائٹ استعمال کرنے کے لیے ریپوزٹری کلون کرنا یا Node.js نصب کرنا ضروری نہیں۔ انگریزی میں [ڈویلپر گائیڈ](../docs/DEVELOPER.md) اور [آرکیٹیکچر دستاویز](ARCHITECTURE/ARCHITECTURE.md) دیکھیں۔

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) ماخذ کی شاخیں، آلات کے پروفائل، پیکج، Kconfig انحصار اور مطابقت کی معلومات جاری کرتا ہے۔

## شکریہ

شکریہ [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [اور تمام پیکج لکھنے والوں اور معاونین کا](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## لائسنس

یہ منصوبہ [GNU GPLv3 یا بعد کے ورژن](../LICENSE) کے تحت ہے۔ حقوق اور رابطے کے لیے [NOTICE](../NOTICE) دیکھیں۔
