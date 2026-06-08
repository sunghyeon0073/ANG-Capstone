package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.ApprovalMyLine;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalMyLineRepository extends JpaRepository<ApprovalMyLine, Long> {

    List<ApprovalMyLine> findByUserOrderByCreatedAtDesc(User user);
}
