package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.domain.approval.entity.UserSignature;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

public class ApprovalSignDto {

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private String imageUrl;
        private String label;
        private LocalDateTime createdAt;

        public static Response from(UserSignature s) {
            return Response.builder()
                    .id(s.getId())
                    .imageUrl(s.getImageUrl())
                    .label(s.getLabel())
                    .createdAt(s.getCreatedAt())
                    .build();
        }
    }
}
