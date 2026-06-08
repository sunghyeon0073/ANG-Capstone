package com.ang.Backend.common.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ApprovalLineType {
    APPROVAL("결재"),
    AGREEMENT("합의"),
    REFERENCE("참조"),
    RECEIVER("수신");

    private final String label;
}
