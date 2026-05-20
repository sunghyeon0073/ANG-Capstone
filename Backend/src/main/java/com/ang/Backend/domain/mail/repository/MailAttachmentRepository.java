package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MailAttachmentRepository extends JpaRepository<MailAttachment, Long> {
    List<MailAttachment> findByMail(Mail mail);
    void deleteByMail(Mail mail);
}
