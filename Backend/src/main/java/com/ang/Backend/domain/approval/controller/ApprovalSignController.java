package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalSignDto;
import com.ang.Backend.domain.approval.service.ApprovalSignService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/approvals/sign")
@RequiredArgsConstructor
public class ApprovalSignController {

    private final ApprovalSignService signService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<ApprovalSignDto.Response> getSign(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(signService.getSign(user));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ApiResponse<ApprovalSignDto.Response> uploadSign(
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(signService.uploadSign(file, user));
    }

    @DeleteMapping
    public ApiResponse<Void> deleteSign(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        signService.deleteSign(user);
        return ApiResponse.ok("서명이 삭제되었습니다.");
    }

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
