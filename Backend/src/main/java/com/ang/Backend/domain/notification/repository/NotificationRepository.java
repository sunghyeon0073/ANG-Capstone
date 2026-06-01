package com.ang.Backend.domain.notification.repository;

import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.domain.notification.entity.Notification;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByReceiverOrderByCreatedAtDesc(User receiver);

    void deleteByReceiver(User receiver);

    void deleteByReceiverAndTargetIdAndType(User receiver, Long targetId, NotificationType type);
}
