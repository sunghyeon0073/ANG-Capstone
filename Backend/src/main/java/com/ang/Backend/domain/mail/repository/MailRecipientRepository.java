package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MailRecipientRepository extends JpaRepository<MailRecipient, Long> {

    // 수신함: 수신자이고 수신자 삭제 안 된 것
    List<MailRecipient> findByRecipientAndDeletedAtIsNull(User recipient);

    // 특정 메일의 수신자 전체
    List<MailRecipient> findByMail(Mail mail);

    // 특정 메일 + 특정 수신자
    Optional<MailRecipient> findByMailAndRecipient(Mail mail, User recipient);

    // 발송 취소 가능 여부 확인용: 아직 아무도 읽지 않았는지
    boolean existsByMailAndReadAtIsNotNull(Mail mail);
}
