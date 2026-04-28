package org.example.capstoneBack.domain.mail.repository;

import org.example.capstoneBack.domain.mail.entity.MailReceiver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MailReceiverRepository extends JpaRepository<MailReceiver, Long> {

    List<MailReceiver> findByReceiverUserIdAndIsDeletedFalse(Long receiverId);

    List<MailReceiver> findByReceiverUserIdAndIsReadFalseAndIsDeletedFalse(Long receiverId);

    Optional<MailReceiver> findByMailMailIdAndReceiverUserId(Long mailId, Long receiverId);
}
