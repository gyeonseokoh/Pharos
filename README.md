# Pharos

1. 옵시디언을 소프트웨어 개발 프로젝트 과정 전반을 보조하는 작업 공간으로 만들고
2. 에이전트로 이를 보조합니다.


&nbsp;

&nbsp;

아래는 개발자들을 위한 공식 안내 번역
--------

# Obsidian 샘플 플러그인

이것은 Obsidian(https://obsidian.md)을 위한 샘플 플러그인입니다.

이 프로젝트는 타입 검사와 문서화를 제공하기 위해 TypeScript를 사용합니다.
이 저장소는 어떤 역할을 하는지 설명하는 TSDoc 주석이 포함된 TypeScript 정의 형식의 최신 플러그인 API(obsidian.d.ts)에 의존합니다.

이 샘플 플러그인은 플러그인 API가 수행할 수 있는 몇 가지 기본 기능들을 보여줍니다.
- 클릭 시 알림(Notice)을 보여주는 리본 아이콘을 추가합니다.
- 모달(Modal)을 여는 "Open modal (simple)" 명령어를 추가합니다.
- 설정 페이지에 플러그인 설정 탭을 추가합니다.
- 전역 클릭 이벤트를 등록하고 콘솔에 'click'을 출력합니다.
- 콘솔에 'setInterval'을 기록하는 전역 인터벌(interval)을 등록합니다.

## 플러그인 개발이 처음이신가요?

신규 플러그인 개발자를 위한 빠른 시작 가이드:

- [누군가 당신이 원하는 플러그인을 이미 개발했는지](https://obsidian.md/plugins) 확인해 보세요! 함께 협력할 수 있을 만큼 충분히 비슷한 기존 플러그인이 있을 수 있습니다.
- "Use this template(이 템플릿 사용)" 버튼을 눌러 이 저장소를 템플릿으로 복사하세요 (버튼이 보이지 않는다면 GitHub에 로그인하세요).
- 저장소를 로컬 개발 폴더로 클론(Clone)하세요. 편의를 위해 이 폴더를 `.obsidian/plugins/사용자-플러그인-이름` 폴더 안에 배치할 수 있습니다.
- NodeJS를 설치한 후, 저장소 폴더의 명령줄(command line)에서 `npm i`를 실행하세요.
- `npm run dev`를 실행하여 `main.ts`를 `main.js`로 컴파일하세요.
- `main.ts`를 수정하세요 (또는 새로운 `.ts` 파일을 생성하세요). 이러한 변경 사항은 자동으로 `main.js`로 컴파일됩니다.
- 플러그인의 새 버전을 불러오려면 Obsidian을 새로고침(Reload)하세요.
- 설정 창에서 플러그인을 활성화하세요.
- Obsidian API를 업데이트하려면 저장소 폴더의 명령줄에서 `npm update`를 실행하세요.

## 새 버전 출시하기

- `manifest.json` 파일을 `1.0.1`과 같은 새 버전 번호와 최신 릴리스에 필요한 최소 Obsidian 버전으로 업데이트하세요.
- 구버전 Obsidian에서 호환되는 구버전 플러그인을 다운로드할 수 있도록 `versions.json` 파일을 `"새-플러그인-버전": "최소-obsidian-버전"` 형식으로 업데이트하세요.
- 새 버전 번호를 "Tag version"으로 사용하여 새로운 GitHub 릴리스를 생성하세요. 접두사 `v`를 포함하지 말고 정확한 버전 번호만 사용하세요. 예시는 여기를 참고하세요: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- `manifest.json`, `main.js`, `styles.css` 파일들을 바이너리 첨부 파일로 업로드하세요. 참고: manifest.json 파일은 저장소의 루트 경로와 릴리스 첨부 파일, 이렇게 두 곳에 모두 있어야 합니다.
- 릴리스를 발행(Publish)하세요.

> `manifest.json`에서 `minAppVersion`을 수동으로 업데이트한 후 `npm version patch`, `npm version minor` 또는 `npm version major`를 실행하여 버전 올리기(version bump) 과정을 간소화할 수 있습니다.
> 이 명령어는 `manifest.json` 및 `package.json`의 버전을 올리고, `versions.json`에 새 버전에 대한 항목을 추가합니다.

## 커뮤니티 플러그인 목록에 내 플러그인 추가하기

- [플러그인 가이드라인](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)을 확인하세요.
- 초기 버전을 발행하세요.
- 저장소 루트에 `README.md` 파일이 있는지 확인하세요.
- 플러그인을 추가하기 위해 https://github.com/obsidianmd/obsidian-releases 에 풀 리퀘스트(Pull Request)를 만드세요.

## 사용 방법

- 이 저장소를 클론하세요.
- NodeJS 버전이 최소 v16 이상인지 확인하세요 (`node --version`).
- `npm i` 또는 `yarn`을 사용하여 의존성 패키지를 설치하세요.
- 감시 모드(watch mode)로 컴파일을 시작하려면 `npm run dev`를 실행하세요.

## 플러그인 수동 설치하기

- `main.js`, `styles.css`, `manifest.json` 파일을 보관함의 `VaultFolder/.obsidian/plugins/사용자-플러그인-ID/` 경로로 복사하세요.

## ESLint를 이용한 코드 품질 향상
- [ESLint](https://eslint.org/)는 코드를 분석하여 문제점을 빠르게 찾아주는 도구입니다. 플러그인에 ESLint를 실행하여 흔한 버그와 코드 개선 방법을 찾을 수 있습니다. 
- 이 프로젝트는 이미 ESLint가 사전 구성되어 있으며, `npm run lint`를 실행하여 검사를 시작할 수 있습니다.
- Obsidian 전용 코드 가이드라인을 위한 커스텀 ESLint [플러그인](https://github.com/obsidianmd/eslint-plugin)도 함께 구성되어 있습니다.
- 모든 브랜치의 모든 커밋에 대해 자동으로 lint를 수행하도록 GitHub Action이 사전 구성되어 있습니다.

## 후원(Funding) URL

플러그인 사용자들이 재정적으로 지원할 수 있도록 후원 URL을 포함할 수 있습니다.

간단한 방법은 `manifest.json` 파일의 `fundingUrl` 필드에 링크를 설정하는 것입니다:

```json
{
    "fundingUrl": "[https://buymeacoffee.com](https://buymeacoffee.com)"
}
```

여러 개의 URL이 있는 경우, 다음과 같이 설정할 수도 있습니다:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "[https://buymeacoffee.com](https://buymeacoffee.com)",
        "GitHub Sponsor": "[https://github.com/sponsors](https://github.com/sponsors)",
        "Patreon": "[https://www.patreon.com/](https://www.patreon.com/)"
    }
}
```


# API 문서

https://docs.obsidian.md 를 참고하세요.