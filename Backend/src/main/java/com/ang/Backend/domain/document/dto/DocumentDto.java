package com.ang.Backend.domain.document.dto;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

public class DocumentDto {
    @Getter @NoArgsConstructor
    public static class AiGenerateRequest {
        private String prompt;
        private Long sourceDocId;
        private List<Long> attachedDocIds;
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
        private Long fileSize;
        private Long previewFileId;
        private String previewFileContentType;
        private String ownerName;
        private Integer ownerId;
        private String scopeName;
        private Integer scopeId;
        private LocalDateTime createdAt;
        private boolean canDelete;

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
                    .fileSize(entity.getFile() != null ? entity.getFile().getFileSize() : null)
                    .previewFileId(entity.getPreviewFile() != null ? entity.getPreviewFile().getFileId() : null)
                    .previewFileContentType(entity.getPreviewFile() != null ? entity.getPreviewFile().getContentType() : null)
                    .ownerName(entity.getOwner() != null ? entity.getOwner().getName() : "Unknown")
                    .ownerId(entity.getOwner() != null ? entity.getOwner().getUserId() : null)
                    .scopeName(entity.getScope() != null ? entity.getScope().getName() : "N/A")
                    .scopeId(entity.getScope() != null ? entity.getScope().getScopeId() : null)
                    .createdAt(entity.getCreatedAt())
                    .build();
        }

        public void setCanDelete(boolean canDelete) {
            this.canDelete = canDelete;
        }
    }
}
