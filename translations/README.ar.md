# Wei.G OpenWrt — تخصيص البرنامج الثابت عبر الإنترنت

اختر الجهاز والحزم من المتصفح، وأرسل طلب البناء عبر GitHub، ودع الخدمة السحابية تتولى تجميع برنامج OpenWrt الثابت.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 مناسب للهاتف · 🌙 سمة فاتحة وداكنة · ✅ يدعم عدة توزيعات مبنية على OpenWrt**

**[🌐 فتح أداة التخصيص](https://www.weigshare.com/wrt/) · [⬇️ تنزيل البرنامج الثابت](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**الأنظمة المدعومة:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**اللغة:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 لغات إضافية</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; **&#x2067;العربية&#x2069;** &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## معاينة الواجهة

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## البدء: أنشئ البرنامج الثابت في ثلاث خطوات

**📖 [دليل مصور خطوة بخطوة](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. اختر المصدر والجهاز والحزم

افتح [**【أداة التخصيص】**](https://www.weigshare.com/wrt/) واختر بالترتيب **【Source】** ← **【Branch】** ← **【Target System】** ← **【Subtarget】** ← **【Target Profile】**. حدد الحزم المطلوبة، وعدّل **【Advanced menuconfig】** والمنطقة الزمنية والمظهر حسب الحاجة. يمكنك استخدام **【تحميل الإعدادات】** لاستيراد `build-request.json` أو `.config` أو `config.buildinfo`. راجع اختياراتك قبل المتابعة.

### 2. أرسل طلب البناء عبر GitHub

[**【سجّل الدخول إلى GitHub】**](https://github.com/login) أولاً، ثم عد إلى [**【أداة التخصيص】**](https://www.weigshare.com/wrt/) واضغط **【إرسال بناء سحابي】** ثم **【تنزيل الطلب وفتح GitHub】**. سينزّل المتصفح ملف `*.json` ويفتح نموذج GitHub Issue. على الكمبيوتر، اسحب ملف JSON إلى خانة الطلب واضغط **【Submit new issue】**. سيرد الروبوت برابط مهمة البناء.

<details>
<summary><strong>تنبيهات مهمة (اضغط للتوسيع)</strong></summary>

> يمكنك فحص الإعدادات والتوافق مسبقاً باستخدام **【فحص】** في شريط الأدوات العائم أسفل يمين الصفحة. ويُجرى الفحص تلقائياً عند إنشاء الطلب أيضاً.
>
> عند اكتشاف مشكلة، طبّق الإصلاح المقترح أو اختر **【الإبقاء والمتابعة بالقوة】**. هذا لا يعالج أخطاء الشيفرة الأصلية، وقد يفشل البناء.
>
> استخدم صفحة GitHub Issue التي فتحتها أداة التخصيص تلقائياً للحفاظ على المعلومات المعبأة مسبقاً.
>
> تنزيل ملف JSON وحده **لا يبدأ البناء**؛ يجب إرسال Issue.
>
> لا تنشر كلمات مرور أو رموز وصول أو أسراراً حقيقية في Issues العامة أو الطلبات أو السجلات.

</details>

### 3. نزّل البرنامج الثابت

افتح الرابط في Issue أو انتقل إلى [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). بعد نجاح المهمة، نزّل البرنامج الثابت من **【Artifacts】** أسفل الصفحة. يحتوي `CONFIG` على الإعدادات و`BUILD-LOGS` على سجلات التشخيص؛ **وهما ليسا ملفات برنامج ثابت قابلة للتثبيت**. تبقى الملفات متاحة **60 يوماً**.

## أسئلة شائعة

<details>
<summary>لماذا لا تتسع مساحة RootFS للحزم الكثيرة؟</summary>

قد تتجاوز الحزم واعتمادياتها حجم قسم RootFS. إذا كان الجهاز يسمح بذلك، ابحث عن `TARGET_ROOTFS_PARTSIZE` ضمن **【Advanced menuconfig】** ثم **【Target Images】** واضبط الحجم حسب الحاجة، مثل 512 أو 1024 MiB. بعض الموجّهات الفعلية لها أقسام ذاكرة ثابتة؛ احذف الحزم غير الضرورية. راجع [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>لماذا يتوقف البناء عند طول المدة؟</summary>

الحد المعتاد للمهمة الواحدة على GitHub-hosted Runner هو ست ساعات. يحدد المشروع **350 دقيقة** للمهمة و**335 دقيقة** للتنفيذ، ليترك وقتاً للسجلات. **يتوقف البناء ولا يُعلّق لاستئنافه لاحقاً**.

</details>

<details>
<summary>كيف أتحقق من سبب فشل البناء؟</summary>

نزّل `BUILD-LOGS` من **【Artifacts】** وابدأ بقراءة `00-SUMMARY.txt`. افحص مساحة RootFS والوقت وأخطاء المصدر والاعتماديات. راجع [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). بعد التعديل أنشئ **Issue جديداً**.

</details>

<details>
<summary>هل يمكن إعادة تشغيل Run قديم بإعدادات جديدة؟</summary>

لا؛ يستخدم Run القديم الطلب الأصلي وإصدارات الشيفرة والبيانات المثبتة وقتها. حمّل الإعدادات الجديدة في الصفحة الحالية وأرسل طلباً جديداً.

</details>

## التطوير والنشر

لا تحتاج إلى استنساخ المستودع أو تثبيت Node.js لاستخدام الموقع. التفاصيل التقنية بالإنجليزية في [دليل المطور](../docs/DEVELOPER.md) و[وثيقة البنية](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

ينشر [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) فروع المصادر وملفات الأجهزة والحزم واعتماديات Kconfig وبيانات التوافق، ويستخدمها الموقع ونظام البناء دون قاعدة بيانات مكررة.

## شكر وتقدير

الشكر إلى [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [وإلى جميع مطوري الحزم والمساهمين](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## الترخيص

يوزّع المشروع بموجب [GNU GPLv3 أو أحدث](../LICENSE). معلومات الحقوق والتواصل في [NOTICE](../NOTICE).
