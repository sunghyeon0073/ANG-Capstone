package com.ang.Backend.domain.approval.entity;

import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "approval_my_line_items")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalMyLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "my_line_id", nullable = false)
    private ApprovalMyLine myLine;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id", nullable = false)
    private User approver;

    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "line_type", nullable = false, length = 20)
    private ApprovalLineType lineType;
}
