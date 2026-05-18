package com.ang.Backend.common.enums;

public enum DocumentStatus {
    DRAFT,          // 임시저장
    IN_APPROVAL,    // 결재 진행 중
    FINAL,          // 결재 완료 (공유 가능)
    ARCHIVED        // 보관됨
}
