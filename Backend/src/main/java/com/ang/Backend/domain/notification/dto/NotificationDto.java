package com.ang.Backend.domain.notification.dto;

import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.domain.notification.entity.Notification;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

public class NotificationDto {

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private NotificationType type;
        private String title;
        private String body;
        private Long targetId;
        private boolean isRead;
        private LocalDateTime createdAt;

        public static Response from(Notification n) {
            return Response.builder()
                    .id(n.getId())
                    .type(n.getType())
                    .title(n.getTitle())
                    .body(n.getBody())
                    .targetId(n.getTargetId())
                    .isRead(n.isRead())
                    .createdAt(n.getCreatedAt())
                    .build();
        }
    }
}
