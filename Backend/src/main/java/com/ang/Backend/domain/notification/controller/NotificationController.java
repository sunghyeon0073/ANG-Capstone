package com.ang.Backend.domain.notification.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.notification.dto.NotificationDto;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<List<NotificationDto.Response>> getNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ApiResponse.ok(notificationService.getNotifications(resolveUser(userDetails)));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAsRead(id, resolveUser(userDetails));
        return ApiResponse.ok("읽음 처리되었습니다.");
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(
            @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAllAsRead(resolveUser(userDetails));
        return ApiResponse.ok("전체 읽음 처리되었습니다.");
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
