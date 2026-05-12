package com.ang.Backend.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // 공통
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "잘못된 입력입니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "리소스를 찾을 수 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다."),

    // 인증
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "만료된 토큰입니다."),
    INVALID_PASSWORD(HttpStatus.UNAUTHORIZED, "비밀번호가 올바르지 않습니다."),
    INVALID_EMP_NO(HttpStatus.UNAUTHORIZED, "사번이 올바르지 않습니다."),

    // 회원
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."),
    DUPLICATE_EMP_NO(HttpStatus.CONFLICT, "이미 사용 중인 사번입니다."),
    DUPLICATE_EMAIL(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다."),
    USER_PENDING(HttpStatus.FORBIDDEN, "관리자 승인 대기 중입니다."),
    USER_ANONYMIZED(HttpStatus.FORBIDDEN, "탈퇴한 계정입니다."),
    INVALID_SCOPE_CODE(HttpStatus.BAD_REQUEST, "유효하지 않은 부서 코드입니다."),
    PASSWORD_POLICY_VIOLATION(HttpStatus.BAD_REQUEST, "비밀번호 정책을 위반했습니다. (6자 이상 24자 이하, 영문+특수문자 조합)"),
    PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "비밀번호와 비밀번호 확인이 일치하지 않습니다."),

    // 부서/스코프
    SCOPE_NOT_FOUND(HttpStatus.NOT_FOUND, "부서/조직을 찾을 수 없습니다."),

    // 역할/권한
    ROLE_NOT_FOUND(HttpStatus.NOT_FOUND, "역할을 찾을 수 없습니다."),
    PERMISSION_DENIED(HttpStatus.FORBIDDEN, "해당 작업에 대한 권한이 없습니다."),

    // 업무
    TASK_NOT_FOUND(HttpStatus.NOT_FOUND, "업무를 찾을 수 없습니다."),

    // 결재
    APPROVAL_NOT_FOUND(HttpStatus.NOT_FOUND, "결재 문서를 찾을 수 없습니다."),
    APPROVAL_ALREADY_PROCESSED(HttpStatus.CONFLICT, "이미 처리된 결재입니다."),
    DELEGATE_NOT_FOUND(HttpStatus.NOT_FOUND, "결재 대리인 지정을 찾을 수 없습니다."),

    // 게시판
    BOARD_NOT_FOUND(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    NOT_AUTHOR(HttpStatus.FORBIDDEN, "작성자만 수정/삭제할 수 있습니다."),

    // 일정
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "일정을 찾을 수 없습니다."),

    // 파일
    FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다."),
    FILE_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "파일 업로드에 실패했습니다."),

    // 문서
    DOCUMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "문서를 찾을 수 없습니다."),

    // 채팅
    CHAT_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "채팅방을 찾을 수 없습니다."),
    NOT_CHAT_MEMBER(HttpStatus.FORBIDDEN, "채팅방 멤버가 아닙니다."),

    // 메일
    MAIL_NOT_FOUND(HttpStatus.NOT_FOUND, "메일을 찾을 수 없습니다."),

    // 알림
    NOTIFICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "알림을 찾을 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(HttpStatus httpStatus, String message) {
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
