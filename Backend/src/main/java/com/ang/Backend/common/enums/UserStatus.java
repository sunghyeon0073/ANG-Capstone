package com.ang.Backend.common.enums;

public enum UserStatus {
    PENDING,      // 승인 대기
    ACTIVE,       // 정상
    ANONYMIZED,   // 탈퇴/익명화
    REJECTED      // 승인 거절
}
