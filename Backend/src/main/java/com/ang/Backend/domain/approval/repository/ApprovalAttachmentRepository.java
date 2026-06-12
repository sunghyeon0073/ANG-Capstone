package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.ApprovalAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalAttachmentRepository extends JpaRepository<ApprovalAttachment, Long> {
    List<ApprovalAttachment> findByDoc_IdOrderByCreatedAtAsc(Long docId);
}
