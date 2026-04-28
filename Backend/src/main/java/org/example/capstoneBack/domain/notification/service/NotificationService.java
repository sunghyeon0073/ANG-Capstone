package org.example.capstoneBack.domain.notification.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.notification.dto.NotificationDto;
import org.example.capstoneBack.domain.notification.entity.Notification;
import org.example.capstoneBack.domain.notification.repository.NotificationRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NotificationDto> getMyNotifications(String empNo) {
        User user = findUserByEmpNo(empNo);
        return notificationRepository.findByUserUserIdOrderByCreatedAtDesc(user.getUserId())
                .stream().map(NotificationDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> getUnreadNotifications(String empNo) {
        User user = findUserByEmpNo(empNo);
        return notificationRepository.findByUserUserIdAndIsReadFalse(user.getUserId())
                .stream().map(NotificationDto::from).toList();
    }

    @Transactional
    public void markAsRead(Long notifId, String empNo) {
        User user = findUserByEmpNo(empNo);
        Notification notification = notificationRepository.findById(notifId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOTIFICATION_NOT_FOUND));
        if (!notification.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        notification.markAsRead();
    }

    @Transactional
    public void markAllAsRead(String empNo) {
        User user = findUserByEmpNo(empNo);
        notificationRepository.findByUserUserIdAndIsReadFalse(user.getUserId())
                .forEach(Notification::markAsRead);
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
