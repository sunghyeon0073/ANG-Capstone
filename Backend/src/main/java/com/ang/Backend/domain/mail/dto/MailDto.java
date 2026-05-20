package com.ang.Backend.domain.mail.dto;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailAttachment;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class MailDto {

    // 메일 발송 요청
    @Getter
    @NoArgsConstructor
    public static class SendRequest {
        private String title;
        private String body;
        private List<String> recipientEmpNos;   // 수신자 사번 목록
    }

    // 임시저장 요청 (수신자 없어도 저장 가능)
    @Getter
    @NoArgsConstructor
    public static class DraftRequest {
        private String title;
        private String body;
        private List<String> recipientEmpNos;
    }

    // 임시저장 수정 요청
    @Getter
    @NoArgsConstructor
    public static class UpdateDraftRequest {
        private String title;
        private String body;
        private List<String> recipientEmpNos;
    }

    // 답장 요청
    @Getter
    @NoArgsConstructor
    public static class ReplyRequest {
        private String body;
    }

    // 파일 다운로드 데이터 (내부 전달용)
    @Getter
    @AllArgsConstructor
    public static class FileDownloadData {
        private String fileName;
        private byte[] bytes;
    }

    // 목록 조회용 (수신함/발신함)
    @Getter
    @Builder
    public static class MailSummary {
        private Long mailId;
        private String title;
        private String senderName;
        private String senderEmpNo;
        private MailStatus status;
        private LocalDateTime sentAt;
        private boolean isRead;             // 수신함용 (발신함에서는 무시)
        private boolean isFavorite;

        public static MailSummary fromMail(Mail mail) {
            return MailSummary.builder()
                    .mailId(mail.getMailId())
                    .title(mail.getTitle())
                    .senderName(mail.getSender().getName())
                    .senderEmpNo(mail.getSender().getEmpNo())
                    .status(mail.getStatus())
                    .sentAt(mail.getSentAt())
                    .isRead(false)
                    .isFavorite(mail.isSenderFavorite())
                    .build();
        }

        public static MailSummary fromRecipient(MailRecipient mr) {
            Mail mail = mr.getMail();
            return MailSummary.builder()
                    .mailId(mail.getMailId())
                    .title(mail.getTitle())
                    .senderName(mail.getSender().getName())
                    .senderEmpNo(mail.getSender().getEmpNo())
                    .status(mail.getStatus())
                    .sentAt(mail.getSentAt())
                    .isRead(mr.isRead())
                    .isFavorite(mr.isFavorite())
                    .build();
        }
    }

    // 첨부파일 정보 (상세 조회 응답용)
    @Getter
    @Builder
    public static class AttachmentInfo {
        private Long attachmentId;
        private String fileUrl;
        private String fileName;

        public static AttachmentInfo from(MailAttachment attachment) {
            return AttachmentInfo.builder()
                    .attachmentId(attachment.getAttachmentId())
                    .fileUrl(attachment.getFileUrl())
                    .fileName(attachment.getFileName())
                    .build();
        }
    }

    // 파일 업로드 응답
    @Getter
    @Builder
    public static class FileUploadResponse {
        private Long attachmentId;
        private String fileUrl;
        private String fileName;

        public static FileUploadResponse from(MailAttachment attachment) {
            return FileUploadResponse.builder()
                    .attachmentId(attachment.getAttachmentId())
                    .fileUrl(attachment.getFileUrl())
                    .fileName(attachment.getFileName())
                    .build();
        }
    }

    // 메일 상세 조회용
    @Getter
    @Builder
    public static class MailDetail {
        private Long mailId;
        private String title;
        private String body;
        private String senderName;
        private String senderEmpNo;
        private MailStatus status;
        private LocalDateTime sentAt;
        private LocalDateTime cancelledAt;
        private LocalDateTime createdAt;
        private List<RecipientInfo> recipients;
        private List<AttachmentInfo> attachments;

        public static MailDetail fromMail(Mail mail, List<MailRecipient> recipients, List<MailAttachment> attachments) {
            return MailDetail.builder()
                    .mailId(mail.getMailId())
                    .title(mail.getTitle())
                    .body(mail.getBody())
                    .senderName(mail.getSender().getName())
                    .senderEmpNo(mail.getSender().getEmpNo())
                    .status(mail.getStatus())
                    .sentAt(mail.getSentAt())
                    .cancelledAt(mail.getCancelledAt())
                    .createdAt(mail.getCreatedAt())
                    .recipients(recipients.stream().map(RecipientInfo::from).toList())
                    .attachments(attachments.stream().map(AttachmentInfo::from).toList())
                    .build();
        }
    }

    // 수신자 정보 (상세 조회 내부)
    @Getter
    @Builder
    public static class RecipientInfo {
        private String recipientName;
        private String recipientEmpNo;
        private boolean isRead;
        private LocalDateTime readAt;

        public static RecipientInfo from(MailRecipient mr) {
            return RecipientInfo.builder()
                    .recipientName(mr.getRecipient().getName())
                    .recipientEmpNo(mr.getRecipient().getEmpNo())
                    .isRead(mr.isRead())
                    .readAt(mr.getReadAt())
                    .build();
        }
    }

    // 수신 확인 목록 (발신자 전용)
    @Getter
    @Builder
    public static class ReadStatusItem {
        private String recipientName;
        private String recipientEmpNo;
        private boolean isRead;
        private LocalDateTime readAt;

        public static ReadStatusItem from(MailRecipient mr) {
            return ReadStatusItem.builder()
                    .recipientName(mr.getRecipient().getName())
                    .recipientEmpNo(mr.getRecipient().getEmpNo())
                    .isRead(mr.isRead())
                    .readAt(mr.getReadAt())
                    .build();
        }
    }
}
