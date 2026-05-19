package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MailRepository extends JpaRepository<Mail, Long> {

    // 발신함: 발신자이고 발신자 삭제 안 된 것 (SENT + CANCELLED)
    List<Mail> findBySenderAndSenderDeletedAtIsNullAndStatusIn(User sender, List<MailStatus> statuses);

    // 임시저장함: 발신자이고 DRAFT 상태
    List<Mail> findBySenderAndStatus(User sender, MailStatus status);
}
