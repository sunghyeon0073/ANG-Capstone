package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.ApprovalMyLine;
import com.ang.Backend.domain.approval.entity.ApprovalMyLineItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalMyLineItemRepository extends JpaRepository<ApprovalMyLineItem, Long> {

    List<ApprovalMyLineItem> findByMyLineOrderByLineOrderAsc(ApprovalMyLine myLine);
}
