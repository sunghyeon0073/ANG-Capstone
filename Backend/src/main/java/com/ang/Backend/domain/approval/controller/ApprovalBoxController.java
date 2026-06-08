package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.common.response.PageResult;
import com.ang.Backend.domain.approval.dto.ApprovalDocDto;
import com.ang.Backend.domain.approval.service.ApprovalBoxService;
import com.ang.Backend.domain.approval.service.ApprovalDocService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalBoxController {

    private final ApprovalBoxService boxService;
    private final ApprovalDocService docService;
    private final UserRepository userRepository;

    @GetMapping("/inbox/pending")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> pendingInbox(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getPendingInbox(user, keyword, page, size));
    }

    @GetMapping("/inbox/completed")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> completedInbox(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getCompletedInbox(user, page, size));
    }

    @GetMapping("/outbox/progress")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> outboxProgress(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getOutboxProgress(user, page, size));
    }

    @GetMapping("/outbox/completed")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> outboxCompleted(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getOutboxCompleted(user, page, size));
    }

    @GetMapping("/outbox/draft")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> outboxDraft(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getOutboxDraft(user, page, size));
    }

    @GetMapping("/outbox/rejected")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> outboxRejected(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getOutboxRejected(user, page, size));
    }

    @GetMapping("/inbox/received")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> receivedInbox(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(boxService.getReceivedInbox(user, page, size));
    }

    @GetMapping("/search")
    public ApiResponse<PageResult<ApprovalDocDto.BoxResponse>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ApprovalStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(docService.search(user, keyword, status, page, size));
    }

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
