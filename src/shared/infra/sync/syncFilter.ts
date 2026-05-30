/**
 * syncFilter.ts
 * 파일 경로가 동기화 대상인지 판별용
 *
 * 지원 패턴 형식: (.gitignore 방식 대충 채택)
 *   1. `**\/segment\/**`  — 경로 어딘가에 해당 세그먼트 포함 여부
 *   2. `*.ext`           — 특정 확장자로 끝나는 파일
 *   3. `prefix\/**`      — 특정 경로로 시작하는 파일
 *   4. 리터럴            — 정확히 일치하는 경로
 *
 * 외부 라이브러리 미사용으로 호환성 ok
 */

/**
 * 패턴 하나가 주어진 filePath와 매치되는지 판별.
 *
 * @param filePath - Vault 루트 기준 상대 경로 (예: "Pharos/tasks/TASK-1.md")
 * @param pattern  - glob 유사 패턴 (예: "**\/.obsidian\/**", "*.tmp", "Pharos/archive\/**")
 */
function matchesPattern(filePath: string, pattern: string): boolean {
    // 패턴 1: **\/something\/** — 경로 중간 세그먼트 포함
    // 예: **\/.obsidian\/** → 경로 어딘가에 /.obsidian/ 포함
    const midSegMatch = pattern.match(/^\*\*\/(.+)\/\*\*$/)
    if (midSegMatch) {
        const segment = midSegMatch[1]
        return (
            filePath.includes(`/${segment}/`) ||  // 중간 위치
            filePath.startsWith(`${segment}/`)    // 루트 직하위
        )
    }

    // 패턴 2: *.ext — 확장자 매치
    // 예: *.tmp → 경로 끝이 .tmp
    const extMatch = pattern.match(/^\*(\..+)$/)
    if (extMatch) {
        return filePath.endsWith(extMatch[1])
    }

    // 패턴 3: prefix/** — 특정 디렉토리 하위 전체
    // 예: Pharos/archive/** → Pharos/archive/ 로 시작하는 모든 경로
    const prefixMatch = pattern.match(/^(.+)\/\*\*$/)
    if (prefixMatch) {
        const prefix = prefixMatch[1]
        return (
            filePath.startsWith(`${prefix}/`) ||
            filePath === prefix               // prefix 자체 파일 포함
        )
    }

    // 패턴 4: 리터럴 — 정확히 일치
    return filePath === pattern
}

/**
 * 주어진 filePath가 동기화 대상인지 판별.
 *
 * patterns 중 하나라도 매치되면 제외(false).
 * patterns가 비어있으면 모든 파일을 동기화 대상으로 간주(true).
 *
 * @param filePath - Vault 루트 기준 상대 경로
 * @param patterns - settings.syncIgnorePatterns 값
 * @returns true = 동기화 대상 / false = 제외
 */
export function shouldSync(filePath: string, patterns: string[]): boolean {
    if (patterns.length === 0) return true
    return !patterns.some((pattern) => matchesPattern(filePath, pattern))
}