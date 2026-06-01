package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MailRecipientRepository extends JpaRepository<MailRecipient, Long> {

    // 수신함: 수신자이고 수신자 삭제 안 된 것
    List<MailRecipient> findByRecipientAndDeletedAtIsNull(User recipient);
    Page<MailRecipient> findByRecipientAndDeletedAtIsNull(User recipient, Pageable pageable);

    // 특정 메일의 수신자 전체
    List<MailRecipient> findByMail(Mail mail);

    // 특정 메일 + 특정 수신자
    Optional<MailRecipient> findByMailAndRecipient(Mail mail, User recipient);

    // 발송 취소 가능 여부 확인용: 아직 아무도 읽지 않았는지
    boolean existsByMailAndReadAtIsNotNull(Mail mail);

    // 수신 휴지통: 삭제된 것
    List<MailRecipient> findByRecipientAndDeletedAtIsNotNull(User recipient);
    Page<MailRecipient> findByRecipientAndDeletedAtIsNotNull(User recipient, Pageable pageable);

    // 수신 즐겨찾기: 즐겨찾기이고 삭제 안 된 것
    List<MailRecipient> findByRecipientAndIsFavoriteTrueAndDeletedAtIsNull(User recipient);
    Page<MailRecipient> findByRecipientAndIsFavoriteTrueAndDeletedAtIsNull(User recipient, Pageable pageable);
}
