package org.example.capstoneBack.domain.approval.repository;

import org.example.capstoneBack.domain.approval.entity.ApprovalDelegate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ApprovalDelegateRepository extends JpaRepository<ApprovalDelegate, Long> {

    List<ApprovalDelegate> findByDelegatorUserId(Long delegatorId);

    @Query("SELECT d FROM ApprovalDelegate d WHERE d.delegator.userId = :delegatorId AND d.isActive = true AND d.startDate <= :now AND d.endDate >= :now")
    Optional<ApprovalDelegate> findActiveDelegate(@Param("delegatorId") Long delegatorId,
                                                   @Param("now") LocalDateTime now);

    @Query("SELECT d FROM ApprovalDelegate d WHERE d.isActive = true AND d.endDate < :now")
    List<ApprovalDelegate> findExpiredDelegates(@Param("now") LocalDateTime now);
}
