package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalCommentDto;
import com.ang.Backend.domain.approval.service.ApprovalCommentService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/approvals/documents/{docId}/comments")
@RequiredArgsConstructor
public class ApprovalCommentController {

    private final ApprovalCommentService commentService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<List<ApprovalCommentDto.Response>> getComments(
            @PathVariable Long docId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(commentService.getComments(docId, user));
    }

    @PostMapping
    public ApiResponse<ApprovalCommentDto.Response> addComment(
            @PathVariable Long docId,
            @RequestBody ApprovalCommentDto.Request req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(commentService.addComment(docId, req, user));
    }

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
