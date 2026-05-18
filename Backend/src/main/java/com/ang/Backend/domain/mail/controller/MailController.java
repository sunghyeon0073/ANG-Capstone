package com.ang.Backend.domain.mail.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.mail.dto.MailDto;
import com.ang.Backend.domain.mail.service.MailService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/mail")
@RequiredArgsConstructor
public class MailController {

    private final MailService mailService;
    private final UserRepository userRepository;

    // 메일 발송
    @PostMapping
    public ResponseEntity<ApiResponse<Long>> send(
            @RequestBody MailDto.SendRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        Long mailId = mailService.send(req, user);
        return ResponseEntity.ok(ApiResponse.ok("메일이 발송되었습니다.", mailId));
    }

    // 임시저장
    @PostMapping("/draft")
    public ResponseEntity<ApiResponse<Long>> saveDraft(
            @RequestBody MailDto.DraftRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        Long mailId = mailService.saveDraft(req, user);
        return ResponseEntity.ok(ApiResponse.ok("임시저장되었습니다.", mailId));
    }

    // 수신함 목록
    @GetMapping("/inbox")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getInbox(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getInbox(user)));
    }

    // 발신함 목록
    @GetMapping("/sent")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getSent(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getSent(user)));
    }

    // 임시저장 목록
    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getDrafts(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getDrafts(user)));
    }

    // 메일 상세 조회 (수신자이면 읽음 자동 처리)
    @GetMapping("/{mailId}")
    public ResponseEntity<ApiResponse<MailDto.MailDetail>> getDetail(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getDetail(mailId, user)));
    }

    // 수신함에서 삭제
    @DeleteMapping("/{mailId}/inbox")
    public ResponseEntity<ApiResponse<Void>> deleteFromInbox(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.deleteFromInbox(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("수신함에서 삭제되었습니다."));
    }

    // 발신함에서 삭제
    @DeleteMapping("/{mailId}/sent")
    public ResponseEntity<ApiResponse<Void>> deleteFromSent(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.deleteFromSent(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("발신함에서 삭제되었습니다."));
    }

    // 발송 취소
    @PostMapping("/{mailId}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.cancel(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("발송이 취소되었습니다."));
    }

    // 수신 확인 목록 (발신자 전용)
    @GetMapping("/{mailId}/read-status")
    public ResponseEntity<ApiResponse<List<MailDto.ReadStatusItem>>> getReadStatus(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getReadStatus(mailId, user)));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
