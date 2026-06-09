package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalActionDto;
import com.ang.Backend.domain.approval.dto.ApprovalDocDto;
import com.ang.Backend.domain.approval.service.ApprovalDocService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/approvals/documents")
@RequiredArgsConstructor
public class ApprovalDocController {

    private final ApprovalDocService docService;
    private final UserRepository userRepository;

    @PostMapping
    public ApiResponse<ApprovalDocDto.Response> create(
            @RequestBody ApprovalDocDto.CreateRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(docService.create(req, user));
    }

    @GetMapping("/{id}")
    public ApiResponse<ApprovalDocDto.Response> getDoc(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(docService.getDoc(id, user));
    }

    @PutMapping("/{id}")
    public ApiResponse<ApprovalDocDto.Response> update(
            @PathVariable Long id,
            @RequestBody ApprovalDocDto.UpdateRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(docService.update(id, req, user));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        docService.cancel(id, user);
        return ApiResponse.ok("문서가 회수되었습니다.");
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Void> getPdf(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        String pdfUrl = docService.getPdfUrl(id, user);
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, pdfUrl)
                .build();
    }

    // ─── 결재 액션 ────────────────────────────────────────────────────────────

    @GetMapping("/{id}/attachment")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        byte[] data = docService.downloadAttachment(id, user);
        String contentType = docService.getAttachmentContentType(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(data);
    }

    @PostMapping(value = "/{id}/attachment", consumes = "multipart/form-data")
    public ApiResponse<Void> uploadAttachment(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        docService.uploadAttachment(id, file, user);
        return ApiResponse.ok("첨부파일이 업로드되었습니다.");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<Void> approve(
            @PathVariable Long id,
            @RequestBody ApprovalActionDto.ApproveRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        docService.approve(id, req, user);
        return ApiResponse.ok("승인 처리되었습니다.");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<Void> reject(
            @PathVariable Long id,
            @RequestBody ApprovalActionDto.RejectRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        docService.reject(id, req, user);
        return ApiResponse.ok("반려 처리되었습니다.");
    }

    @PostMapping("/{id}/delegate")
    public ApiResponse<Void> delegate(
            @PathVariable Long id,
            @RequestBody ApprovalActionDto.DelegateRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        docService.delegate(id, req, user);
        return ApiResponse.ok("대리결재 처리되었습니다.");
    }


    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
