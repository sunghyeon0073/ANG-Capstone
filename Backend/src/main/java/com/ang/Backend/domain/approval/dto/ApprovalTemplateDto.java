package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.domain.approval.entity.ApprovalTemplate;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

public class ApprovalTemplateDto {

    @Getter
    @Builder
    public static class CreateRequest {
        private String title;
        private String category;
        private String formSchema;
    }

    @Getter
    @Builder
    public static class UpdateRequest {
        private String title;
        private String category;
        private String formSchema;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private String title;
        private String category;
        private String formSchema;
        private Boolean isActive;
        private LocalDateTime createdAt;

        public static Response from(ApprovalTemplate t) {
            return Response.builder()
                    .id(t.getId())
                    .title(t.getTitle())
                    .category(t.getCategory())
                    .formSchema(t.getFormSchema())
                    .isActive(t.getIsActive())
                    .createdAt(t.getCreatedAt())
                    .build();
        }
    }
}
