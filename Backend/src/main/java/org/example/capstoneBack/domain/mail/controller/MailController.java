package org.example.capstoneBack.domain.mail.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.mail.dto.MailDto;
import org.example.capstoneBack.domain.mail.dto.MailSendRequest;
import org.example.capstoneBack.domain.mail.service.MailService;
import org.springframework.http.HttpStatus;
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

    /** Mail-01: 메일 작성/발송 */
    @PostMapping
    public ResponseEntity<ApiResponse<MailDto>> sendMail(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody MailSendRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(mailService.sendMail(userDetails.getUsername(), request)));
    }

    /** Mail-02: 받은 메일함 */
    @GetMapping("/inbox")
    public ResponseEntity<ApiResponse<List<MailDto>>> getInbox(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(mailService.getInbox(userDetails.getUsername())));
    }

    /** 보낸 메일함 */
    @GetMapping("/sent")
    public ResponseEntity<ApiResponse<List<MailDto>>> getSentMails(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(mailService.getSentMails(userDetails.getUsername())));
    }

    /** 메일 읽음 처리 */
    @PatchMapping("/{mailId}/read")
    public ResponseEntity<ApiResponse<Void>> readMail(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        mailService.readMail(mailId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("메일을 읽었습니다."));
    }

    /** Mail-04: 메일 삭제 */
    @DeleteMapping("/{mailId}")
    public ResponseEntity<ApiResponse<Void>> deleteMail(
            @PathVariable Long mailId,
            @AuthenticationPrincipal UserDetails userDetails) {
        mailService.deleteMail(mailId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("메일이 삭제되었습니다."));
    }
}
