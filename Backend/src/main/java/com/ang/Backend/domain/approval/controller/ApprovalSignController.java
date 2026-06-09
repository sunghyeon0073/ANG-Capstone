package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalSignDto;
import com.ang.Backend.domain.approval.service.ApprovalSignService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/approvals/sign")
@RequiredArgsConstructor
public class ApprovalSignController {

    private final ApprovalSignService signService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<List<ApprovalSignDto.Response>> listSigns(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ApiResponse.ok(signService.listSigns(getUser(userDetails)));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ApiResponse<ApprovalSignDto.Response> uploadSign(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "label", required = false) String label,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ApiResponse.ok(signService.uploadSign(file, label, getUser(userDetails)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSign(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        signService.deleteSign(id, getUser(userDetails));
        return ApiResponse.ok("서명이 삭제되었습니다.");
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> getSignImage(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        byte[] data = signService.downloadSign(id, getUser(userDetails));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "image/png")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(data);
    }

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
