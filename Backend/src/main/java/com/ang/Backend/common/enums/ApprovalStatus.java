package com.ang.Backend.common.enums;

public enum ApprovalStatus {
    DRAFT,        // 임시저장
    IN_PROGRESS,  // 결재 진행 중
    APPROVED,     // 최종 승인 완료
    REJECTED,     // 반려
    CANCELLED,    // 회수/취소
    EXPIRED       // 보존기한 만료 (파기됨)
}
