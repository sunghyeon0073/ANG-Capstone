package com.ang.Backend.domain.aiassistant.entity;

import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduled_actions")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ScheduledAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "scheduled_action_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 20)
    private ScheduledActionChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ScheduledActionStatus status = ScheduledActionStatus.PENDING;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "recipient_emp_nos", columnDefinition = "TEXT")
    private String recipientEmpNos;

    @Column(name = "recipient_names", columnDefinition = "TEXT")
    private String recipientNames;

    @Column(name = "chat_room_id")
    private Long chatRoomId;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "file_ids", columnDefinition = "TEXT")
    private String fileIds;

    @Column(name = "original_prompt", columnDefinition = "TEXT")
    private String originalPrompt;

    @Column(name = "result_target_id")
    private Long resultTargetId;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void markSent(Long targetId) {
        status = ScheduledActionStatus.SENT;
        resultTargetId = targetId;
        sentAt = LocalDateTime.now();
        errorMessage = null;
    }

    public void markFailed(String message) {
        status = ScheduledActionStatus.FAILED;
        errorMessage = message;
    }

    public void cancel() {
        status = ScheduledActionStatus.CANCELLED;
    }
}
