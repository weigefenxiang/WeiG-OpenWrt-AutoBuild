# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (Brasil)](README.pt.md) · [日本語](README.ja.md) · 한국어 · [Deutsch (Sie)](README.de.md) · [Français (vous)](README.fr.md) · [Tiếng Việt](README.vi.md)

OpenWrt 펌웨어 **온라인 커스터마이징 + 클라우드 빌드**. 웹 페이지에서 소스를 고르고, 버전을 선택하고, 플러그인을 체크하면 GitHub Actions가 자동으로 컴파일하며, 펌웨어는 무료로 받아 갈 수 있습니다.

현재 **360T7(MT7981)** 이 완전 유지 관리 대상 기종입니다. 페이지의 나머지 200여 개 기종은 **시드 모드**로 개방되어 있습니다("부팅 가능" 수준만 보장되며 실제 기기에서 검증되지 않았으므로 위험은 본인 부담입니다. 완전 유지 관리 등급으로 승격하는 방법은 아래 유지 관리자 섹션을 참고하세요).

⭐ **Star는 여러분이 보내 주실 수 있는 가장 큰 응원이며, 여러분의 Star가 곧 업데이트의 원동력입니다!**

- 커스터마이징 페이지(메인 사이트): <https://wrt.weigefenxiang.cc.cd>
- 커스터마이징 페이지(블로그 백업 사본): <https://www.weigeshare.cc.cd/wrt/>
- 세 가지 소스 라인: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt 공식](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **버전 브랜치**: ImmortalWrt의 모든 원격 브랜치를 수록합니다. OpenWrt는 `main`과 모든 `openwrt-*` 브랜치를 수록하되 `lede-17.01`, `pcs-standalone-back`, `master`는 제외합니다. 페이지는 소스·브랜치·장치 Profile별로 별도 설정을 생성하며 업스트림에 실제로 존재하는 조합만 표시합니다.
- 인터페이스는 **11개 언어**(중국어 간체/중국어 번체/영어/러시아어/스페인어/포르투갈어/일본어/한국어/독일어/프랑스어/베트남어)를 지원하며, 브라우저 언어를 자동으로 따라가고 오른쪽 위에서 수동으로 전환할 수도 있습니다. 번역이 없는 항목은 자동으로 영어로 대체됩니다.

---

## 사용자라면: 펌웨어 커스터마이징 방법

1. 커스터마이징 페이지를 열고 **소스 → 파티션 변형 → 플러그인** 순서로 선택한 뒤, "빌드 식별자"(펌웨어를 찾을 때 쓰이는 여러분의 닉네임)를 입력합니다.
2. **클라우드 빌드 제출 → 요청 다운로드 및 GitHub 열기**를 누르세요. 방금 받은 `build-request.json` 하나만 업로드하고 **Create**를 누르면 되며 기기, 소스, 버전, 파티션을 입력할 필요가 없습니다. 기존 `.config` 또는 `config.buildinfo`는 먼저 웹페이지에서 불러와 기기를 식별하세요.
3. 봇이 Issue에 이번 빌드의 링크를 답글로 남기며, 전체 컴파일에는 약 **2~3시간**이 걸립니다.
4. 빌드가 완료되면 봇이 댓글로 알려 줍니다. 빌드 페이지를 열고 하단의 **Artifacts**에서 다운로드하세요:
   - `FIRMWARE-ALL-…`: 모든 펌웨어와 검증 자료. 최초 설치는 보통 이름에 `factory`가 있는 파일을 사용합니다;
   - `CONFIG-…`: 제출 설정, `make defconfig` 결과와 차이;
   - `BUILD-LOGS-…`: 전체 다운로드/빌드 로그와 오류 발췌. 성공과 실패 모두 제공하며 14일 보관합니다.
5. 빌드하지 않으려면 **클라우드 빌드 제출 → .config만 다운로드**를 선택해 현재 선택으로 만든 전체 설정(defconfig 확장 전)을 즉시 저장할 수 있습니다.
6. `build-request.json`, `.config`, `config.buildinfo`를 불러올 수 있습니다. 시간대는 OpenWrt/LuCI 전체 IANA 목록을 검색하며 `(UTC±HH:MM) Region/City` 형식으로 통일됩니다. LuCI 테마, NTP, opkg 미러도 선택할 수 있습니다.

> 💡 펌웨어를 플래싱한 뒤: 브라우저에서 **192.168.1.1**(또는 제출 페이지에서 직접 지정한 주소)로 접속하세요. 사용자 이름은 **root**, **비밀번호는 비어 있습니다**(첫 로그인 시 즉시 설정하세요). 단, Lean LEDE 소스만 초기 비밀번호가 `password`입니다.
>
> 💡 페이지 오른쪽 위에 **자가 진단** 버튼이 있습니다. 데이터 소스 도달 가능성(로컬/jsDelivr/raw 3단계), .config 생성 로직, GitHub 연결 상태를 원클릭으로 점검하니, 로딩에 문제가 있으면 먼저 이 버튼으로 원인을 확인해 보세요.
>
> 💡 의존성이 있는 플러그인(예: MWAN3 트래픽 분산 도우미)을 선택하면 선행 플러그인이 자동으로 함께 선택됩니다. 커널/라이브러리 수준의 의존성은 컴파일 시 자동으로 채워지므로 신경 쓸 필요가 없습니다.
>
> ⚠️ Artifacts를 다운로드하려면 GitHub에 로그인해야 합니다. 펌웨어, 설정, 빌드 정보는 30일간, `BUILD-LOGS`는 14일간 보관됩니다.
>
> ⚠️ 플래싱에는 위험이 따릅니다. **108M 대용량 파티션** 변형은 언브릭 U-Boot(ubootmod)를 미리 플래싱해 두어야 합니다. **순정 파티션** 변형은 파티션을 바꾸지 않고 바로 플래싱할 수 있지만 공간이 작아서, 플러그인을 많이 선택하면 컴파일이 실패하거나 설치 공간이 부족할 수 있습니다.

### Actions에서 내 펌웨어 찾기

빌드 목록은 `Build 定制 · 你的标识 · 源码 版本/变体` 형식으로 이름이 붙으므로, 자신이 입력한 식별자를 찾으면 됩니다: 저장소 → **Actions** → **custom-build**.

## Fork로 직접 빌드하기

공용 저장소에서 대기하고 싶지 않거나 기본 설정을 바꾸고 싶다면 완전히 셀프서비스로 진행할 수 있습니다:

1. 오른쪽 위의 **Fork**를 눌러 이 저장소를 자신의 계정으로 복제합니다.
2. 자신의 Fork에서 **Settings → Features에서 Issues를 체크**하고, **Actions 페이지에서 초록색 버튼을 눌러 workflows를 활성화**합니다.
3. 커스터마이징 페이지로 돌아가 ④단계에서 **내 Fork**를 선택하고 자신의 GitHub 사용자 이름을 입력하면, 이후 제출하는 빌드는 자신의 무료 사용량 안에서 실행됩니다.
4. 페이지가 `build-request.json`을 내려받고 필수 첨부 칸 하나뿐인 Issue 양식을 엽니다. 파일을 제출하면 Actions가 그 안의 전체 `.config`를 직접 사용하며 저장소 base config로 다시 만들지 않습니다.

## 유지 관리자라면: 플러그인 추가 / 설정 변경 방법

데이터 흐름: `config/<브랜드>/<기종>/*.config`는 이전 설정 불러오기와 과거 요청 호환용으로 유지합니다(360T7은 현재 소스/브랜치/Profile 조합 14개). 새 빌드 매개변수는 `WeiG-OpenWrt-Menuconfig-Catalog`에서 동적으로 가져오며, 각 Issue 빌드는 `build-request.json`에 내보낸 완전한 `.config`를 최종 입력으로 사용합니다.

### 플러그인 옵션 추가하기

1. base config 4개에 해당 패키지의 `# CONFIG_PACKAGE_luci-app-xxx is not set` 줄이 이미 있는지 확인합니다(없다면 해당 소스의 feeds에 이 패키지가 없다는 뜻이므로, 먼저 diy 스크립트에서 feed를 추가하고 base config를 업데이트해야 합니다).
2. `tools/plugins-meta.json`의 `plugins` 배열에 항목을 하나 추가합니다: `{ "id": "xxx", "name": "中文名", "group": "分组", "desc": "一句话说明", "size": 2, "hot": false }` (패키지 이름이 `luci-app-` 접미사 규칙과 다르거나 세 소스에서 이름이 서로 다르면 `pkgs` 필드로 명시적으로 매핑하고, luci-app 수준의 선행 플러그인이 있으면 `requires: ["선행id"]`를 추가하면 페이지에서 자동으로 연동 선택됩니다).
3. `node tools/gen-plugins.mjs`를 실행합니다. 스크립트가 `site/wrt/data/360t7/plugins.json`을 다시 생성하고 base config 사본을 동기화하며, "설정에는 있지만 수록되지 않은" 플러그인에 대해 경고를 표시합니다.
4. 커밋하고 push합니다. 페이지 코드는 전혀 수정할 필요 없이 새 옵션이 자동으로 나타납니다.

### 라우터 기종 개방/추가하기

기종 목록은 `site/wrt/data/devices.json`에 있으며 브랜드별로 구성됩니다. 360T7은 완전 유지 관리 등급이고, 나머지 기종은 **시드 모드**입니다(sources가 템플릿으로 생성되고, 시드 플러그인 목록을 공유하며, 부팅 가능만 보장됩니다). 시드 기종 하나를 완전 유지 관리 등급으로 승격하는 단계:

1. `devices.json`에서 해당 기종을 찾아 실제 상황에 맞게 `sources`를 채웁니다(소스별 config 파일 이름, versions 브랜치, variants 변형 및 파티션 치환 쌍).
2. `config/<브랜드>/<기종id>/`에 각 소스의 base 설정을 넣습니다. 명명 규칙은 `<브랜드>_<기종>_<소스>.config`입니다(저장소에는 대부분의 기종에 대해 대상 기종 + LuCI만 포함하는 "부팅만 가능한 최소 구성" 시드 설정이 이미 생성되어 있으므로, 그대로 쓰거나 그 위에 원하는 것을 추가하면 됩니다).
3. `node tools/gen-plugins.mjs`를 실행합니다(개방된 기종마다 각각의 plugins.json을 생성합니다).
4. 스모크 테스트: 소스별로 클라우드 빌드를 한 번씩 실행해 이미지가 정상적으로 나오는지 확인합니다.

페이지와 workflow 코드는 전혀 수정할 필요가 없으며, `device` 파라미터는 평소처럼 화이트리스트로 검증됩니다.

### 디렉터리 구조와 기술 아키텍처

[ARCHITECTURE.md](../ARCHITECTURE.md)를 참고하세요(중국어/영어 이중 언어).

### 보안

- Issue는 GitHub 첨부 파일 1~3개를 받고 `build-request.json`, `.config`, `config.buildinfo`를 자동 판별합니다. 필드, 허용 목록, 크기, 대상 서명을 검증하며 제출한 전체 설정을 기준으로 삼고 `make defconfig` 차이도 보관합니다.
- 빌드 식별자(tag)는 중문/영문 문자, 숫자, 하이픈만 남도록 정제되며, artifact 이름 지정과 표시에만 사용됩니다.
- workflow 권한은 `contents: read + issues: write`로 최소화되어 있습니다.

### 문서 다국어 유지 관리 규칙

**이 README(또는 사용자 대상의 모든 md 문서)를 수정할 때마다 `translations/` 아래의 해당 언어 버전을 반드시 함께 업데이트해야 합니다.** 개발자 문서도 마찬가지입니다(`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). 이는 각 언어 버전이 서로 어긋나는 것을 막기 위한 엄격한 규칙입니다.

## 감사의 말

이 프로젝트에 직접 또는 간접적으로 기여해 주신 모든 오픈소스 프로젝트와 작성자분들께 감사드립니다:

- **소스**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **인프라**: [GitHub Actions](https://github.com/features/actions)(클라우드 빌드) · [Cloudflare Pages](https://pages.cloudflare.com/)(백업 사이트 호스팅)
- **<!--plugin-count-->226<!--/plugin-count-->개 LuCI 플러그인의 모든 작성자**, 그리고 LuCI, Hexo, Butterfly 테마 등 생태계 프로젝트.
- Issue를 제출하고, 문제를 알려 주고, Star를 눌러 주신 모든 사용자 한 분 한 분.

이 프로젝트는 위 프로젝트들을 오케스트레이션하여 호출할 뿐이며, 저작권은 각 작성자에게 있습니다.
