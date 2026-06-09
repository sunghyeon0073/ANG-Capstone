package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.domain.approval.entity.ApprovalAttachment;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class ApprovalDocDto {

    @Getter
    @Builder
    public static class CreateRequest {
        private Long templateId;
        private String title;
        private String formData;
        private String attachmentUrl;
        private boolean submitNow;
        private String securityLevel;
        private String retentionPeriod;
        private List<ApprovalLineDto.Request> approvalLines;
    }

    @Getter
    @Builder
    public static class UpdateRequest {
        private String title;
        private String formData;
        private String attachmentUrl;
        private boolean submitNow;
        private String securityLevel;
        private String retentionPeriod;
        private List<ApprovalLineDto.Request> approvalLines;
    }

    @Getter
    @Builder
    public static class AttachmentInfo {
        private Long id;
        private String fileName;
        private String contentType;

        public static AttachmentInfo from(ApprovalAttachment a) {
            return AttachmentInfo.builder()
                    .id(a.getId())
                    .fileName(a.getFileName())
                    .contentType(a.getContentType())
                    .build();
        }
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private Long templateId;
        private String templateTitle;
        private Integer drafterId;
        private String drafterName;
        private String drafterPosition;
        private String title;
        private String formData;
        private ApprovalStatus status;
        private String attachmentUrl;
        private String attachmentName;
        private String finalPdfUrl;
        private String securityLevel;
        private String retentionPeriod;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime completedAt;
        private List<ApprovalLineDto.Response> approvalLines;
        private List<AttachmentInfo> attachments;

        public static Response from(ApprovalDoc doc) {
            return Response.builder()
                    .id(doc.getId())
                    .templateId(doc.getTemplate() != null ? doc.getTemplate().getId() : null)
                    .templateTitle(doc.getTemplate() != null ? doc.getTemplate().getTitle() : null)
                    .drafterId(doc.getDrafter().getUserId())
                    .drafterName(doc.getDrafter().getName())
                    .drafterPosition(doc.getDrafter().getPosition())
                    .title(doc.getTitle())
                    .formData(doc.getFormData())
                    .status(doc.getStatus())
                    .attachmentUrl(doc.getAttachmentUrl())
                    .attachmentName(doc.getAttachmentName())
                    .finalPdfUrl(doc.getFinalPdfUrl())
                    .securityLevel(doc.getSecurityLevel())
                    .retentionPeriod(doc.getRetentionPeriod())
                    .createdAt(doc.getCreatedAt())
                    .updatedAt(doc.getUpdatedAt())
                    .completedAt(doc.getCompletedAt())
                    .approvalLines(doc.getApprovalLines().stream()
                            .map(ApprovalLineDto.Response::from)
                            .collect(Collectors.toList()))
                    .attachments(doc.getAttachments().stream()
                            .map(AttachmentInfo::from)
                            .collect(Collectors.toList()))
                    .build();
        }
    }

    @Getter
    @Builder
    public static class BoxResponse {
        private Long id;
        private String title;
        private String drafterName;
        private ApprovalStatus status;
        private LocalDateTime createdAt;
        private LocalDateTime completedAt;

        public static BoxResponse from(ApprovalDoc doc) {
            return BoxResponse.builder()
                    .id(doc.getId())
                    .title(doc.getTitle())
                    .drafterName(doc.getDrafter().getName())
                    .status(doc.getStatus())
                    .createdAt(doc.getCreatedAt())
                    .completedAt(doc.getCompletedAt())
                    .build();
        }
    }
}
