package org.example.capstoneBack.domain.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.domain.notification.entity.Notification;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class NotificationDto {

    private Long notifId;
    private Long userId;
    private String notifType;
    private String message;
    private String targetUrl;
    private boolean isRead;
    private LocalDateTime createdAt;

    public static NotificationDto from(Notification notification) {
        return NotificationDto.builder()
                .notifId(notification.getNotifId())
                .userId(notification.getUser().getUserId())
                .notifType(notification.getNotifType())
                .message(notification.getMessage())
                .targetUrl(notification.getTargetUrl())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
