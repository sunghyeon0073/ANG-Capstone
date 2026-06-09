package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.domain.approval.entity.ApprovalComment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

public class ApprovalCommentDto {

    @Getter
    public static class Request {
        private String content;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private Integer authorId;
        private String authorName;
        private String content;
        private LocalDateTime createdAt;

        public static Response from(ApprovalComment c) {
            return Response.builder()
                    .id(c.getId())
                    .authorId(c.getAuthor().getUserId())
                    .authorName(c.getAuthor().getName())
                    .content(c.getContent())
                    .createdAt(c.getCreatedAt())
                    .build();
        }
    }
}
