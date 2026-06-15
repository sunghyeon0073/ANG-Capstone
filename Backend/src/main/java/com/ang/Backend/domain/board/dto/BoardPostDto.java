package com.ang.Backend.domain.board.dto;

import com.ang.Backend.domain.board.entity.BoardAttachment;
import com.ang.Backend.domain.board.entity.BoardPost;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class BoardPostDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRequest {
        private String title;
        private String content;
        private String type;
        private boolean pinned;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRequest {
        private String title;
        private String content;
        private String type;
        private boolean pinned;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttachmentInfo {
        private Long attachmentId;
        private String fileName;
        private Long fileSize;
        private String contentType;

        public static AttachmentInfo from(BoardAttachment att) {
            return AttachmentInfo.builder()
                    .attachmentId(att.getAttachmentId())
                    .fileName(att.getFileName())
                    .fileSize(att.getFileSize())
                    .contentType(att.getContentType())
                    .build();
        }
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private Integer authorId;
        private String author;
        private String type;
        private String title;
        private String content;
        private boolean pinned;
        private int views;
        private List<AttachmentInfo> attachments;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static Response from(BoardPost post) {
            return Response.builder()
                    .id(post.getPostId())
                    .authorId(post.getAuthor().getUserId())
                    .author(post.getAuthor().getName())
                    .type(post.getType())
                    .title(post.getTitle())
                    .content(post.getContent())
                    .pinned(post.isPinned())
                    .views(post.getViews())
                    .attachments(post.getAttachments().stream()
                            .map(AttachmentInfo::from)
                            .collect(Collectors.toList()))
                    .createdAt(post.getCreatedAt())
                    .updatedAt(post.getUpdatedAt())
                    .build();
        }
    }
}
