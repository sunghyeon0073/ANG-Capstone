package org.example.capstoneBack.domain.mail.repository;

import org.example.capstoneBack.domain.mail.entity.Mail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MailRepository extends JpaRepository<Mail, Long> {

    List<Mail> findBySenderUserId(Long senderId);
}
