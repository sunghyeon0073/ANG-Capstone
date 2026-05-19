package com.ang.Backend.domain.mail.repository;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MailRepository extends JpaRepository<Mail, Long> {

    // 발신함: 발신자이고 발신자 삭제 안 된 것 (SENT + CANCELLED)
    List<Mail> findBySenderAndSenderDeletedAtIsNullAndStatusIn(User sender, List<MailStatus> statuses);

    // 임시저장함: 발신자이고 DRAFT 상태
    List<Mail> findBySenderAndStatus(User sender, MailStatus status);

    // 발신 휴지통: 발신자이고 발신자 삭제된 것 (SENT + CANCELLED)
    List<Mail> findBySenderAndSenderDeletedAtIsNotNullAndStatusIn(User sender, List<MailStatus> statuses);

    // 발신 즐겨찾기: 발신자이고 즐겨찾기이고 삭제 안 된 것
    List<Mail> findBySenderAndIsSenderFavoriteTrueAndSenderDeletedAtIsNull(User sender);

    // 기존 NULL 행 교정 (ddl-auto:update 후 NULL로 추가된 컬럼 처리)
    @Modifying
    @Query(value = "UPDATE mails SET is_sender_favorite = 0 WHERE is_sender_favorite IS NULL", nativeQuery = true)
    void fixNullSenderFavorite();
}
