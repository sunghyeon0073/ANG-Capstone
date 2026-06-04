package com.ang.Backend.common.enums;

public enum ApprovalLineType {
    APPROVAL,   // 결재 (순차 처리)
    AGREEMENT,  // 합의 (순차 처리)
    REFERENCE,  // 참조 (열람 권한만)
    RECEIVER    // 수신 (최종 승인 후 열람함에 도착)
}
