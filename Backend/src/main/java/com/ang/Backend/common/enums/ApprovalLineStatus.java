package com.ang.Backend.common.enums;

public enum ApprovalLineStatus {
    WAITING,    // 예정(비활성) - 아직 차례 아님
    ACTIVE,     // 대기(활성) - 현재 결재 차례
    APPROVED,   // 승인 완료
    REJECTED,   // 반려
    DELEGATED   // 대결 처리됨
}
