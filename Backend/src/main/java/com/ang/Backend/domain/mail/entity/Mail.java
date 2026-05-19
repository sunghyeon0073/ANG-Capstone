package com.ang.Backend.domain.mail.entity;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "mails")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Mail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mail_id")
    private Long mailId;

    // 발신자
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", columnDefinition = "LONGTEXT")
    private String body;

    // DRAFT → 임시저장, SENT → 발송, CANCELLED → 발송 취소
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    @Builder.Default
    private MailStatus status = MailStatus.DRAFT;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;           // 발송 시각 (DRAFT면 null)

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;      // 발송 취소 시각

    @Column(name = "sender_deleted_at")
    private LocalDateTime senderDeletedAt;  // 발신자가 발신함에서 삭제한 시각

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
