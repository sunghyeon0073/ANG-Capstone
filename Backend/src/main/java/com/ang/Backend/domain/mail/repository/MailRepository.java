package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MailRepository extends JpaRepository<Mail, Long> {

    // 발신함: 발신자이고 발신자 삭제 안 된 것 (SENT + CANCELLED)
    List<Mail> findBySenderAndSenderDeletedAtIsNullAndStatusIn(User sender, List<MailStatus> statuses);
    Page<Mail> findBySenderAndSenderDeletedAtIsNullAndStatusIn(User sender, List<MailStatus> statuses, Pageable pageable);

    // 임시저장함: 발신자이고 DRAFT 상태
    List<Mail> findBySenderAndStatus(User sender, MailStatus status);
    Page<Mail> findBySenderAndStatus(User sender, MailStatus status, Pageable pageable);

    // 발신 휴지통: 발신자이고 발신자 삭제된 것 (SENT + CANCELLED)
    List<Mail> findBySenderAndSenderDeletedAtIsNotNullAndStatusIn(User sender, List<MailStatus> statuses);
    Page<Mail> findBySenderAndSenderDeletedAtIsNotNullAndStatusIn(User sender, List<MailStatus> statuses, Pageable pageable);

    // 발신 즐겨찾기: 발신자이고 즐겨찾기이고 삭제 안 된 것
    List<Mail> findBySenderAndIsSenderFavoriteTrueAndSenderDeletedAtIsNull(User sender);
    Page<Mail> findBySenderAndIsSenderFavoriteTrueAndSenderDeletedAtIsNull(User sender, Pageable pageable);

    // ANG 비서 검색: 발신 메일에서 제목 키워드 검색
    @org.springframework.data.jpa.repository.Query(
        "SELECT m FROM Mail m WHERE m.sender = :user AND m.senderDeletedAt IS NULL AND m.status IN :statuses " +
        "AND (:keyword IS NULL OR m.title LIKE %:keyword%) " +
        "ORDER BY m.sentAt DESC")
    List<Mail> searchSentByKeyword(
        @org.springframework.data.repository.query.Param("user") User user,
        @org.springframework.data.repository.query.Param("keyword") String keyword,
        @org.springframework.data.repository.query.Param("statuses") java.util.List<com.ang.Backend.common.enums.MailStatus> statuses,
        org.springframework.data.domain.Pageable pageable);
}
