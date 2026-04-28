package org.example.capstoneBack.domain.approval.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.common.enums.ApprovalLineStatus;
import org.example.capstoneBack.domain.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "approval_lines")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ApprovalLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "line_id")
    private Long lineId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_id", nullable = false)
    private Approval approval;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id", nullable = false)
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actual_approver_id")
    private User actualApprover;

    @Column(name = "is_delegated")
    @Builder.Default
    private boolean isDelegated = false;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    @Builder.Default
    private ApprovalLineStatus status = ApprovalLineStatus.PENDING;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public void approve(User actualApprover, String comment, boolean isDelegated) {
        this.status = ApprovalLineStatus.APPROVED;
        this.actualApprover = actualApprover;
        this.comment = comment;
        this.isDelegated = isDelegated;
        this.processedAt = LocalDateTime.now();
    }

    public void reject(User actualApprover, String comment, boolean isDelegated) {
        this.status = ApprovalLineStatus.REJECTED;
        this.actualApprover = actualApprover;
        this.comment = comment;
        this.isDelegated = isDelegated;
        this.processedAt = LocalDateTime.now();
    }
}
