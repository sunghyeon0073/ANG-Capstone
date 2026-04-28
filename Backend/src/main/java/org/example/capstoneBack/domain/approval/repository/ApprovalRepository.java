package org.example.capstoneBack.domain.approval.repository;

import org.example.capstoneBack.common.enums.ApprovalStatus;
import org.example.capstoneBack.domain.approval.entity.Approval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalRepository extends JpaRepository<Approval, Long> {

    List<Approval> findByRequesterUserId(Long userId);

    List<Approval> findByScopeScopeId(Long scopeId);

    List<Approval> findByStatus(ApprovalStatus status);

    List<Approval> findByRequesterUserIdAndStatus(Long userId, ApprovalStatus status);
}
