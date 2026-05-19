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

    // 임시저장 삭제
    @DeleteMapping("/{mailId}/draft")
    public ResponseEntity<ApiResponse<Void>> deleteDraft(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.deleteDraft(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("임시저장이 삭제되었습니다."));
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

    // 수신 즐겨찾기 토글
    @PostMapping("/{mailId}/favorite/inbox")
    public ResponseEntity<ApiResponse<Boolean>> toggleInboxFavorite(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        boolean result = mailService.toggleInboxFavorite(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok(result ? "즐겨찾기에 추가되었습니다." : "즐겨찾기에서 해제되었습니다.", result));
    }

    // 발신 즐겨찾기 토글
    @PostMapping("/{mailId}/favorite/sent")
    public ResponseEntity<ApiResponse<Boolean>> toggleSentFavorite(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        boolean result = mailService.toggleSentFavorite(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok(result ? "즐겨찾기에 추가되었습니다." : "즐겨찾기에서 해제되었습니다.", result));
    }

    // 즐겨찾기 통합 목록
    @GetMapping("/favorites")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getFavorites(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getFavorites(user)));
    }

    // 수신 휴지통 목록
    @GetMapping("/trash/inbox")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getInboxTrash(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getInboxTrash(user)));
    }

    // 발신 휴지통 목록
    @GetMapping("/trash/sent")
    public ResponseEntity<ApiResponse<List<MailDto.MailSummary>>> getSentTrash(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getSentTrash(user)));
    }

    // 수신 휴지통에서 복원
    @PostMapping("/{mailId}/restore/inbox")
    public ResponseEntity<ApiResponse<Void>> restoreFromInboxTrash(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.restoreFromInboxTrash(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("수신함으로 복원되었습니다."));
    }

    // 발신 휴지통에서 복원
    @PostMapping("/{mailId}/restore/sent")
    public ResponseEntity<ApiResponse<Void>> restoreFromSentTrash(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.restoreFromSentTrash(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("발신함으로 복원되었습니다."));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
    }
}
