package com.ang.Backend.domain.notification.service;

import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.notification.dto.NotificationDto;
import com.ang.Backend.domain.notification.entity.Notification;
import com.ang.Backend.domain.notification.repository.NotificationRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void send(User receiver, NotificationType type, String title, String body, Long targetId) {
        Notification notification = notificationRepository.save(Notification.builder()
                .receiver(receiver)
                .type(type)
                .title(title)
                .body(body)
                .targetId(targetId)
                .build());
        messagingTemplate.convertAndSendToUser(
                receiver.getEmpNo(), "/queue/notification",
                NotificationDto.Response.from(notification)
        );
    }

    public List<NotificationDto.Response> getNotifications(User user) {
        return notificationRepository.findByReceiverOrderByCreatedAtDesc(user)
                .stream()
                .map(NotificationDto.Response::from)
                .toList();
    }

    @Transactional
    public void markAsRead(Long id, User user) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.NOTIFICATION_NOT_FOUND));
        if (!notification.getReceiver().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.NOTIFICATION_NOT_FOUND);
        }
        notificationRepository.deleteById(id);
    }

    @Transactional
    public void markAllAsRead(User user) {
        notificationRepository.deleteByReceiver(user);
    }

    @Transactional
    public void deleteByTarget(User user, Long targetId, NotificationType type) {
        notificationRepository.deleteByReceiverAndTargetIdAndType(user, targetId, type);
    }
}
