package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.entity.ApprovalLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApprovalLineRepository extends JpaRepository<ApprovalLine, Long> {

    List<ApprovalLine> findByDocOrderByLineOrderAsc(ApprovalDoc doc);

    // 현재 유저의 ACTIVE 라인 조회 (원래 결재자 또는 대결자)
    @Query("SELECT al FROM ApprovalLine al WHERE al.doc.id = :docId " +
           "AND (al.approver.userId = :userId OR al.delegatee.userId = :userId) " +
           "AND al.status = 'ACTIVE'")
    Optional<ApprovalLine> findActiveLineByDocAndUser(@Param("docId") Long docId,
                                                      @Param("userId") Integer userId);

    // 다음 WAITING 라인 조회 (현재 lineOrder 이후)
    @Query("SELECT al FROM ApprovalLine al WHERE al.doc = :doc " +
           "AND al.status = 'WAITING' " +
           "AND al.lineType IN ('APPROVAL', 'AGREEMENT') " +
           "ORDER BY al.lineOrder ASC")
    List<ApprovalLine> findNextWaitingLines(@Param("doc") ApprovalDoc doc);

    List<ApprovalLine> findByDocAndStatus(ApprovalDoc doc, ApprovalLineStatus status);
}
