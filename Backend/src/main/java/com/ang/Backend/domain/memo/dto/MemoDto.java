package com.ang.Backend.domain.memo.dto;

import com.ang.Backend.domain.memo.entity.Memo;
import lombok.*;

import java.time.LocalDateTime;

public class MemoDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SaveRequest {
        private String title;
        private String content;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private String title;
        private String content;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static Response from(Memo memo) {
            return Response.builder()
                    .id(memo.getMemoId())
                    .title(memo.getTitle())
                    .content(memo.getContent())
                    .createdAt(memo.getCreatedAt())
                    .updatedAt(memo.getUpdatedAt())
                    .build();
        }
    }
}
