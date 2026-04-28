package org.example.capstoneBack.domain.notification.controller;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.notification.dto.NotificationDto;
import org.example.capstoneBack.domain.notification.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** Alert-01: 전체 알림 조회 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getMyNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                notificationService.getMyNotifications(userDetails.getUsername())));
    }

    /** 읽지 않은 알림 조회 */
    @GetMapping("/unread")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getUnreadNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                notificationService.getUnreadNotifications(userDetails.getUsername())));
    }

    /** 알림 읽음 처리 */
    @PatchMapping("/{notifId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable Long notifId,
            @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAsRead(notifId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("알림을 읽었습니다."));
    }

    /** 전체 읽음 처리 */
    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(
            @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAllAsRead(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("모든 알림을 읽었습니다."));
    }
}
