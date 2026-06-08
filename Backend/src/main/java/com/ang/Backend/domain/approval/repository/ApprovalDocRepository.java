package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ApprovalDocRepository extends JpaRepository<ApprovalDoc, Long> {

    // 발신 문서함: 기안자 + 상태
    Page<ApprovalDoc> findByDrafterAndStatusOrderByCreatedAtDesc(User drafter, ApprovalStatus status, Pageable pageable);

    // 결재 대기함: 내가 ACTIVE 결재자인 문서
    @Query("SELECT DISTINCT ad FROM ApprovalDoc ad JOIN ad.approvalLines al " +
           "WHERE (al.approver.userId = :userId OR al.delegatee.userId = :userId) " +
           "AND al.status = :activeStatus " +
           "AND (:keyword IS NULL OR ad.title LIKE %:keyword%)")
    Page<ApprovalDoc> findPendingInbox(@Param("userId") Integer userId,
                                       @Param("activeStatus") ApprovalLineStatus activeStatus,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);

    // 결재 완료함: 내가 APPROVED/REJECTED 처리한 문서
    @Query("SELECT DISTINCT ad FROM ApprovalDoc ad JOIN ad.approvalLines al " +
           "WHERE (al.approver.userId = :userId OR al.delegatee.userId = :userId) " +
           "AND al.status IN :statuses")
    Page<ApprovalDoc> findCompletedInbox(@Param("userId") Integer userId,
                                         @Param("statuses") List<ApprovalLineStatus> statuses,
                                         Pageable pageable);

    // 수신함: RECEIVER 타입으로 등록된 사용자가 보는 최종 승인 문서
    @Query("SELECT DISTINCT ad FROM ApprovalDoc ad JOIN ad.approvalLines al " +
           "WHERE al.approver.userId = :userId AND al.lineType = :lineType " +
           "AND ad.status = :docStatus")
    Page<ApprovalDoc> findReceivedInbox(@Param("userId") Integer userId,
                                        @Param("lineType") ApprovalLineType lineType,
                                        @Param("docStatus") ApprovalStatus docStatus,
                                        Pageable pageable);

    // 보존연한 만료 대상 조회
    List<ApprovalDoc> findByStatusAndCompletedAtIsNotNull(ApprovalStatus status);

    // 통합 검색
    @Query("SELECT ad FROM ApprovalDoc ad WHERE " +
           "(ad.drafter.userId = :userId OR EXISTS (" +
           "  SELECT 1 FROM ApprovalLine al WHERE al.doc = ad " +
           "  AND (al.approver.userId = :userId OR al.delegatee.userId = :userId)" +
           ")) " +
           "AND (:keyword IS NULL OR ad.title LIKE %:keyword%) " +
           "AND (:status IS NULL OR ad.status = :status)")
    Page<ApprovalDoc> search(@Param("userId") Integer userId,
                             @Param("keyword") String keyword,
                             @Param("status") ApprovalStatus status,
                             Pageable pageable);
}
