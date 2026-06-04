package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
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
           "AND al.status = :status")
    Optional<ApprovalLine> findActiveLineByDocAndUser(@Param("docId") Long docId,
                                                      @Param("userId") Integer userId,
                                                      @Param("status") ApprovalLineStatus status);

    // 다음 처리 대기 라인: 가장 작은 lineOrder의 WAITING 결재/합의 라인 1건
    @Query("SELECT al FROM ApprovalLine al WHERE al.doc = :doc " +
           "AND al.status = :waitingStatus " +
           "AND al.lineType IN :actionableTypes " +
           "AND al.lineOrder = (SELECT MIN(al2.lineOrder) FROM ApprovalLine al2 " +
           "                    WHERE al2.doc = :doc AND al2.status = :waitingStatus " +
           "                    AND al2.lineType IN :actionableTypes)")
    List<ApprovalLine> findNextWaitingLines(@Param("doc") ApprovalDoc doc,
                                            @Param("waitingStatus") ApprovalLineStatus waitingStatus,
                                            @Param("actionableTypes") List<ApprovalLineType> actionableTypes);

    List<ApprovalLine> findByDocAndStatus(ApprovalDoc doc, ApprovalLineStatus status);
}
