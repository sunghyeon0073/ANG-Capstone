package com.ang.Backend.domain.document.dto;

import lombok.*;

public class DocumentDto {
    @Getter @NoArgsConstructor
    public static class UpdateRequest {
        private String title;
        private String content;
    }

    @Getter @Builder
    public static class Response {
        private Long docId;
        private String title;
        private String originalContent;
        private String aiSummary;
        private String originalFileName;
    }
}