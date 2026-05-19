package com.ang.Backend.domain.document.dto;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import lombok.*;

import java.time.LocalDateTime;

public class DocumentDto {
    @Getter @NoArgsConstructor
    public static class AiGenerateRequest {
        private String prompt;
        private Long sourceDocId;
    }

    @Getter @NoArgsConstructor
    public static class UpdateRequest {
        private String title;
        private String content;
        private DocumentStatus status;
    }

    @Getter @Builder
    public static class Response {
        private Long docId;
        private String title;
        private String originalContent;
        private String aiSummary;
        private DocumentStatus status;
        private String originalFileName;
        private Long fileId;
        private String fileContentType;
        private String ownerName;
        private String scopeName;
        private LocalDateTime createdAt;

        public static Response fromEntity(DocumentEntity entity) {
            return Response.builder()
                    .docId(entity.getDocId())
                    .title(entity.getTitle())
                    .originalContent(entity.getOriginalContent())
                    .aiSummary(entity.getAiSummary())
                    .status(entity.getStatus())
                    .originalFileName(entity.getFile() != null ? entity.getFile().getOriginalFileName() : null)
                    .fileId(entity.getFile() != null ? entity.getFile().getFileId() : null)
                    .fileContentType(entity.getFile() != null ? entity.getFile().getContentType() : null)
                    .ownerName(entity.getOwner() != null ? entity.getOwner().getName() : "Unknown")
                    .scopeName(entity.getScope() != null ? entity.getScope().getName() : "N/A")
                    .createdAt(entity.getCreatedAt())
                    .build();
        }
    }
}
