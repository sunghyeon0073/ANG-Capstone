package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.ApprovalTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalTemplateRepository extends JpaRepository<ApprovalTemplate, Long> {

    List<ApprovalTemplate> findByIsActiveTrueOrderByCreatedAtDesc();

    List<ApprovalTemplate> findByCategoryAndIsActiveTrueOrderByCreatedAtDesc(String category);
}
