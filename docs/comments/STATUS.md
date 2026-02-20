# Review Comments Status

아래는 docs/architecture/comments 폴더의 코멘트 파일들에 대한 처리 상태입니다.

- API_SUBMISSIONS_COMMENT.md — Adopt
  - 이유: submissions 엔드포인트에 대한 상세 API 스펙(요청/응답/인증/레이트리밋)은 필수적이므로 별도 docs/api/API_SPEC.md로 채택하여 구현하였습니다.

- SECURITY_CHECKLIST_COMMENT.md — Adopt (부분)
  - 이유: 보안 체크리스트의 대부분 항목(투표 무결성, 토큰 관리 등)은 핵심이므로 docs/security/SECURITY.md로 통합하였고, 일부 고급 항목은 운영 정책에서 보완할 예정입니다.

참고: 원본 코멘트 파일은 보존되어 있으며, 처리 세부사항은 각 새 문서의 관련 섹션에 반영하였습니다. 추가로 보류(Defer) 또는 거부(Reject) 항목이 생기면 이 파일을 업데이트하겠습니다.