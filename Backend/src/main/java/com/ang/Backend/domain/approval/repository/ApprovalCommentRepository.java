package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.ApprovalComment;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalCommentRepository extends JpaRepository<ApprovalComment, Long> {

    List<ApprovalComment> findByDocOrderByCreatedAtAsc(ApprovalDoc doc);
}
