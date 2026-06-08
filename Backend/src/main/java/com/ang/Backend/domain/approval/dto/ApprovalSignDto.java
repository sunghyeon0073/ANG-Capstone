package com.ang.Backend.domain.approval.dto;

import lombok.Builder;
import lombok.Getter;

public class ApprovalSignDto {

    @Getter
    @Builder
    public static class Response {
        private String signatureImageUrl;
    }
}
