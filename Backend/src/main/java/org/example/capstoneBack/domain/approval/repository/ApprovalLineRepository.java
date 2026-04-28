package org.example.capstoneBack.domain.approval.repository;

import org.example.capstoneBack.common.enums.ApprovalLineStatus;
import org.example.capstoneBack.domain.approval.entity.ApprovalLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApprovalLineRepository extends JpaRepository<ApprovalLine, Long> {

    List<ApprovalLine> findByApprovalApprovalIdOrderByStepOrder(Long approvalId);

    List<ApprovalLine> findByApproverUserIdAndStatus(Long approverId, ApprovalLineStatus status);

    @Query("SELECT al FROM ApprovalLine al WHERE al.approval.approvalId = :approvalId AND al.status = 'PENDING' ORDER BY al.stepOrder ASC")
    Optional<ApprovalLine> findFirstPendingLine(@Param("approvalId") Long approvalId);
}
