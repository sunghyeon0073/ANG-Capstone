package com.ang.Backend.domain.approval.entity;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "approval_lines",
    indexes = {
        @Index(name = "idx_al_doc_approver_status", columnList = "doc_id, approver_id, status"),
        @Index(name = "idx_al_doc_order", columnList = "doc_id, line_order")
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doc_id", nullable = false)
    private ApprovalDoc doc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id", nullable = false)
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delegatee_id")
    private User delegatee;

    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "line_type", nullable = false, length = 20)
    private ApprovalLineType lineType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ApprovalLineStatus status = ApprovalLineStatus.WAITING;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "signature_snapshot")
    private String signatureSnapshot;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
