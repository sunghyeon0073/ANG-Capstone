 POST /api/mail
 { "title": "테스트", "body": "내용", "recipientEmpNos": ["EMP001"] }

 # 2. 수신함 조회 (수신자 계정으로)
 GET /api/mail/inbox

 # 3. 메일 상세 → readAt 자동 기록
 GET /api/mail/{mailId}

 # 4. 수신 확인 (발신자 계정으로)
 GET /api/mail/{mailId}/read-status

 # 5. 발송 취소 (아무도 안 읽은 상태에서)
 POST /api/mail/{mailId}/cancel

 # 6. 양방향 삭제 확인
 DELETE /api/mail/{mailId}/inbox
 DELETE /api/mail/{mailId}/sent
