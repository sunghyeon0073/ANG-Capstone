package com.ang.Backend.domain.approval.dto;

import lombok.Getter;

public class ApprovalActionDto {

    @Getter
    public static class ApproveRequest {
        private String comment;
    }

    @Getter
    public static class RejectRequest {
        private String reason;
    }

    @Getter
    public static class DelegateRequest {
        private Integer delegateeId;
        private String comment;
    }
}
