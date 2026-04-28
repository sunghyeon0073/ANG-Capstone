package org.example.capstoneBack.domain.approval.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.approval.dto.*;
import org.example.capstoneBack.domain.approval.service.ApprovalService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    /** Approval-01-1: 결재 요청 */
    @PostMapping
    public ResponseEntity<ApiResponse<ApprovalDto>> createApproval(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ApprovalCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(approvalService.createApproval(userDetails.getUsername(), request)));
    }

    /** Approval-01-4: 결재 조회 */
    @GetMapping("/{approvalId}")
    public ResponseEntity<ApiResponse<ApprovalDto>> getApproval(@PathVariable Long approvalId) {
        return ResponseEntity.ok(ApiResponse.ok(approvalService.getApproval(approvalId)));
    }

    /** 내가 요청한 결재 목록 */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<ApprovalDto>>> getMyApprovals(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.getMyApprovals(userDetails.getUsername())));
    }

    /** 내가 결재해야 할 목록 */
    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<ApprovalDto>>> getPendingForApprover(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.getPendingForApprover(userDetails.getUsername())));
    }

    /** Approval-01-2: 결재 승인 */
    @PostMapping("/{approvalId}/approve")
    public ResponseEntity<ApiResponse<Void>> approveApproval(
            @PathVariable Long approvalId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ApprovalProcessRequest request) {
        approvalService.processApproval(approvalId, userDetails.getUsername(), true, request);
        return ResponseEntity.ok(ApiResponse.ok("결재가 승인되었습니다."));
    }

    /** Approval-01-3: 결재 반려 */
    @PostMapping("/{approvalId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectApproval(
            @PathVariable Long approvalId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ApprovalProcessRequest request) {
        approvalService.processApproval(approvalId, userDetails.getUsername(), false, request);
        return ResponseEntity.ok(ApiResponse.ok("결재가 반려되었습니다."));
    }

    /** Approval-01-5: 결재 대리인 지정 (팀장 이상) */
    @PostMapping("/delegate")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> createDelegate(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ApprovalDelegateRequest request) {
        approvalService.createDelegate(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("결재 대리인이 지정되었습니다."));
    }

    /** 결재 대리인 해제 */
    @DeleteMapping("/delegate/{delegateId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> revokeDelegate(
            @PathVariable Long delegateId,
            @AuthenticationPrincipal UserDetails userDetails) {
        approvalService.revokeDelegate(delegateId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("대리인 지정이 해제되었습니다."));
    }
}
