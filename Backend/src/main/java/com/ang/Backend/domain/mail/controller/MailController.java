package com.ang.Backend.domain.mail.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.common.response.PageResult;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.mail.dto.MailDto;
import com.ang.Backend.domain.mail.service.MailService;
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

import java.util.List;
import java.util.Collections;

@RestController
@RequestMapping("/mail")
@RequiredArgsConstructor
public class MailController {

    private final MailService mailService;
    private final UserRepository userRepository;

    // 메일 발송 (파일 첨부 가능)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Long>> send(
            @RequestPart("data") MailDto.SendRequest req,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        Long mailId = mailService.send(req, user, files != null ? files : Collections.emptyList());
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
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getInbox(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getInbox(user, page, size)));
    }

    // 발신함 목록
    @GetMapping("/sent")
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getSent(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getSent(user, page, size)));
    }

    // 임시저장 목록
    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getDrafts(user, page, size)));
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

    // 메일 첨부 가능한 파일 목록 (본인이 업로드한 파일)
    @GetMapping("/attachable-files")
    public ResponseEntity<ApiResponse<List<FileDto>>> getAttachableFiles(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getAttachableFiles(user)));
    }

    // 파일 다운로드
    @GetMapping("/files/{attachmentId}")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        MailDto.FileDownloadData data = mailService.downloadFile(attachmentId, user);
        String encodedName = java.net.URLEncoder.encode(data.getFileName(), java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encodedName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data.getBytes());
    }

    // 파일 업로드
    @PostMapping("/files")
    public ResponseEntity<ApiResponse<MailDto.FileUploadResponse>> uploadFile(
            @RequestParam("mailId") Long mailId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok("파일이 업로드되었습니다.", mailService.uploadFile(mailId, file, user)));
    }

    // 임시저장 수정
    @PutMapping("/{mailId}/draft")
    public ResponseEntity<ApiResponse<Long>> updateDraft(
            @PathVariable Long mailId,
            @RequestBody MailDto.UpdateDraftRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok("임시저장이 수정되었습니다.", mailService.updateDraft(mailId, req, user)));
    }

    // 임시저장에서 발송
    @PostMapping("/{mailId}/send")
    public ResponseEntity<ApiResponse<Long>> sendDraft(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok("메일이 발송되었습니다.", mailService.sendDraft(mailId, user)));
    }

    // 답장
    @PostMapping("/{mailId}/reply")
    public ResponseEntity<ApiResponse<Long>> reply(
            @PathVariable Long mailId,
            @RequestBody MailDto.ReplyRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok("답장이 발송되었습니다.", mailService.reply(mailId, req, user)));
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
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getFavorites(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getFavorites(user, page, size)));
    }

    // 수신 휴지통 목록
    @GetMapping("/trash/inbox")
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getInboxTrash(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getInboxTrash(user, page, size)));
    }

    // 발신 휴지통 목록
    @GetMapping("/trash/sent")
    public ResponseEntity<ApiResponse<PageResult<MailDto.MailSummary>>> getSentTrash(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(mailService.getSentTrash(user, page, size)));
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

    // 수신 휴지통 완전 삭제
    @DeleteMapping("/trash/inbox/{mailId}")
    public ResponseEntity<ApiResponse<Void>> permanentDeleteFromInboxTrash(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.permanentDeleteFromInboxTrash(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("메일이 완전히 삭제되었습니다."));
    }

    // 발신 휴지통 완전 삭제
    @DeleteMapping("/trash/sent/{mailId}")
    public ResponseEntity<ApiResponse<Void>> permanentDeleteFromSentTrash(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        mailService.permanentDeleteFromSentTrash(mailId, user);
        return ResponseEntity.ok(ApiResponse.ok("메일이 완전히 삭제되었습니다."));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
    }
}
