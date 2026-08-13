# GitHub Copilot 모듈

## 개요

**Copilot** 모듈은 GitHub Copilot을 통해 번역해요. **Copilot 구독이 활성화된** 계정의 GitHub 토큰으로 인증하며, 자격 증명 보관함에 `GITHUB_TOKEN` 키로 저장해요.

## 자격 증명 보관함에 토큰 추가

제공업체 자격 증명은 일반 설정이 아니라 암호화된 **자격 증명 보관함**에 저장돼요. 보관함은 세션마다 한 번, 비밀번호로 잠금을 해제해요.

1. 사이드바에서 **글로벌 설정**을 여세요.
2. 아직 보관함을 만들지 않았다면 만드세요: 보관함 비밀번호를 정하고(세션마다 다시 사용해요) 잠금을 해제하세요.
3. **모듈 활성화** 아래에서 **GitHub Copilot**을 선택하세요. 필요한 키가 없으면 보관함 편집기가 해당 키를 자동으로 열어요. 그렇지 않으면 **자격 증명 보관함 관리**를 클릭하세요.
4. 보관함 편집기에서 자격 증명을 추가하세요: 키로 `GITHUB_TOKEN`을 선택하고, 값으로 발급받은 토큰을 붙여넣은 다음 **보관함 비밀번호**를 입력하고 **저장**을 클릭하세요.

모델 목록에 *사용 가능한 모델이 없어요*가 표시되면 토큰이 없거나 잘못됐거나, 보관함이 잠겨 있는 거예요 — 보관함 잠금을 해제하거나 GitHub 토큰을 확인한 다음 카드를 다시 여세요.

## GitHub 토큰 발급

Copilot 접근 권한만 부여하도록 **세부 권한(fine-grained)** 개인 액세스 토큰을 사용하세요.

1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)에 방문하세요.
2. **Generate new token**을 클릭하세요(세부 권한 토큰이 기본값이에요).
3. 이름을 붙이고(예: "Translator-Copilot") **Expiration**을 설정하세요.
4. **Permissions → Account permissions** 아래에서 **Copilot Requests**를 찾아 **Read-only**로 설정하세요. 다른 권한은 필요 없어요.
5. **Generate token**을 클릭하고 즉시 복사하세요 — GitHub은 이 토큰을 한 번만 보여줘요.
6. 보관함 편집기의 `GITHUB_TOKEN` 값 칸에 붙여넣으세요.

토큰을 발급받은 계정에 Copilot 구독이 활성화되어 있어야 번역이 성공해요.
