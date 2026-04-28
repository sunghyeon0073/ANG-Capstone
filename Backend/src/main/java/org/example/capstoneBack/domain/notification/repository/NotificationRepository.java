package org.example.capstoneBack.domain.notification.repository;

import org.example.capstoneBack.domain.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserUserIdOrderByCreatedAtDesc(Long userId);

    List<Notification> findByUserUserIdAndIsReadFalse(Long userId);

    List<Notification> findByUserUserIdAndNotifType(Long userId, String notifType);
}
