# Wei.G OpenWrt — התאמה אישית של קושחה באינטרנט

בוחרים מכשיר וחבילות בדפדפן, שולחים בקשת בנייה דרך GitHub ונותנים לענן לקמפל את קושחת OpenWrt.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 מותאם לנייד · 🌙 ערכת נושא בהירה וכהה · ✅ גרסאות שונות של OpenWrt**

**[🌐 פתיחת כלי ההתאמה](https://www.weigshare.com/wrt/) · [⬇️ הורדת קושחה](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**מערכות נתמכות:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**שפה:** [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

<details>
<summary><b>🔤 שפות נוספות</b></summary>

<div dir="ltr">
[Asturianu](README.ast.md) &lrm;·&lrm; [Azərbaycanca](README.az.md) &lrm;·&lrm; [Беларуская](README.be.md) &lrm;·&lrm; [Български](README.bg.md) &lrm;·&lrm; [বাংলা](README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](README.bn-BD.md) &lrm;·&lrm; [Català](README.ca.md) &lrm;·&lrm; [Čeština](README.cs.md) &lrm;·&lrm; [Dansk](README.da.md) &lrm;·&lrm; [Ελληνικά](README.el.md) &lrm;·&lrm; [Suomi](README.fi.md) &lrm;·&lrm; [Filipino](README.fil.md) &lrm;·&lrm; [Gaeilge](README.ga.md) &lrm;·&lrm; [हिन्दी](README.hi.md) &lrm;·&lrm; [Magyar](README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](README.id.md) &lrm;·&lrm; [Italiano](README.it.md) &lrm;·&lrm; [ქართული](README.ka.md) &lrm;·&lrm; [ລາວ](README.lo.md) &lrm;·&lrm; [Lietuvių](README.lt.md) &lrm;·&lrm; [Latviešu](README.lv.md) &lrm;·&lrm; [മലയാളം](README.ml.md) &lrm;·&lrm; [मराठी](README.mr.md) &lrm;·&lrm; [Bahasa Melayu](README.ms.md) &lrm;·&lrm; [Norsk bokmål](README.nb-NO.md) &lrm;·&lrm; [Nederlands](README.nl.md) &lrm;·&lrm; [Polski](README.pl.md) &lrm;·&lrm; [Português (Brasil)](README.pt-BR.md) &lrm;·&lrm; [Română](README.ro.md) &lrm;·&lrm; [Slovenčina](README.sk.md) &lrm;·&lrm; [Svenska](README.sv.md) &lrm;·&lrm; [தமிழ்](README.ta.md) &lrm;·&lrm; [Türkçe](README.tr.md) &lrm;·&lrm; [Українська](README.uk.md) &lrm;·&lrm; [Màaya t'aan](README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](README.fa.md) &lrm;·&lrm; **&#x2067;עברית&#x2069;** &lrm;·&lrm; [&#x2067;اردو&#x2069;](README.ur.md)
</div>

</details>

## תצוגה מקדימה של הממשק

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile" width="21.30%">
</p>

## מתחילים: קושחה בשלושה שלבים

**📖 [מדריך מצולם מלא](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. בחירת מקור, מכשיר וחבילות

פותחים את [**【כלי ההתאמה המקוון】**](https://www.weigshare.com/wrt/) ובוחרים **【Source】** ← **【Branch】** ← **【Target System】** ← **【Subtarget】** ← **【Target Profile】**. מסמנים את החבילות הרצויות ומשנים לפי הצורך את **【Advanced menuconfig】**, אזור הזמן וערכת הנושא. באמצעות **【טעינת תצורה】** אפשר לייבא `build-request.json`, `.config` או `config.buildinfo`. כדאי לבדוק את ההגדרות לפני ההמשך.

### 2. שליחת בקשת בנייה ב-GitHub

תחילה [**【נכנסים לחשבון GitHub】**](https://github.com/login), חוזרים ל[**【כלי ההתאמה】**](https://www.weigshare.com/wrt/) ולוחצים על **【שליחת בנייה בענן】** ← **【הורדת הבקשה ופתיחת GitHub】**. הדפדפן יוריד קובץ `*.json` ויפתח טופס GitHub Issue. במחשב גוררים את JSON לשדה הבקשה ולוחצים **【Submit new issue】**. הבוט יענה עם קישור לריצת הבנייה.

<details>
<summary><strong>הערות חשובות (לפתיחה)</strong></summary>

> אפשר לבדוק מראש הגדרות והמלצות תאימות באמצעות **【בדיקה】** בסרגל הצף בפינה הימנית התחתונה. בעת יצירת הבקשה הבדיקה רצה גם אוטומטית.
>
> אם מתגלות בעיות, אפשר להחיל תיקון מוצע או לבחור **【שמירה והמשך בכל זאת】**. המשך כפוי אינו מתקן באגים בקוד המקור ועלול להיכשל.
>
> השתמשו בטופס GitHub Issue שנפתח אוטומטית מכלי ההתאמה כדי לא לאבד את הפרטים שמולאו מראש.
>
> הורדת JSON בלבד **לא מתחילה בנייה**. צריך לשלוח את ה-Issue.
>
> אין לפרסם סיסמאות אמיתיות, אסימוני גישה או סודות ב-Issues ציבוריים, בבקשות או ביומנים.

</details>

### 3. הורדת הקושחה

עוקבים אחרי הקישור ב-Issue או נכנסים ל[**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). לאחר הצלחה מורידים את הקושחה מתוך **【Artifacts】**. `CONFIG` מכיל קובצי הגדרות ו-`BUILD-LOGS` יומני אבחון; **אלה אינם קובצי קושחה לצריבה**. הקבצים נשמרים **60 יום**.

## שאלות נפוצות

<details>
<summary>למה אין מספיק מקום ב-RootFS עם הרבה חבילות?</summary>

החבילות והתלויות שלהן עשויות לחרוג מגודל מחיצת RootFS. אם המכשיר מאפשר זאת, משנים את `TARGET_ROOTFS_PARTSIZE` בתוך **【Advanced menuconfig】** ← **【Target Images】**, למשל ל-512 או ל-1024 MiB. בנתבים פיזיים מסוימים המחיצות קבועות וצריך לצמצם חבילות. ראו [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233).

</details>

<details>
<summary>למה בנייה ארוכה נעצרת?</summary>

Job ב-GitHub-hosted Runner מוגבל בדרך כלל לשש שעות. בפרויקט הזה נקבעו **350 דקות**, והביצוע נעצר אחרי **335 דקות** כדי לאסוף יומנים. זוהי **עצירה, לא השהיה שאפשר להמשיך ממנה**.

</details>

<details>
<summary>איך מבררים את הסיבה לכישלון הבנייה?</summary>

מורידים את `BUILD-LOGS` מתוך **【Artifacts】** וקוראים קודם את `00-SUMMARY.txt`. בודקים RootFS, זמן, קוד מקור ותלויות. דוגמאות ב-[Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). אחרי התיקון יוצרים **Issue חדש**.

</details>

<details>
<summary>אפשר להפעיל Run ישן עם הגדרות חדשות?</summary>

לא. Run ישן משתמש בבקשה המקורית ובגרסאות הקוד והנתונים שננעלו אז. יש לטעון את ההגדרות החדשות ולשלוח בקשה חדשה.

</details>

## פיתוח ופריסה

לשימוש באתר אין צורך לשכפל מאגר או להתקין Node.js. מידע טכני באנגלית נמצא ב[מדריך למפתחים](../docs/DEVELOPER.md) וב[מסמך הארכיטקטורה](ARCHITECTURE/ARCHITECTURE.md).

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) מפרסם ענפי מקור, פרופילים של מכשירים, חבילות, תלויות Kconfig ונתוני תאימות לאתר ולמערכת הבנייה.

## תודות

תודה ל [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) [ולכל מפתחי החבילות והתורמים](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog).

## רישיון

הפרויקט מופץ תחת [GNU GPLv3 ומעלה](../LICENSE). פרטי זכויות יוצרים ויצירת קשר נמצאים ב-[NOTICE](../NOTICE).
