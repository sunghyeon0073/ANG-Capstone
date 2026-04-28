package org.example.capstoneBack.domain.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.auth.dto.PasswordChangeRequest;
import org.example.capstoneBack.domain.user.dto.UserDto;
import org.example.capstoneBack.domain.user.dto.UserUpdateRequest;
import org.example.capstoneBack.domain.user.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ──────────────── 마이페이지 (User-01) ────────────────

    /** User-01-1: 내 정보 조회 */
    @GetMapping("/users/me")
    public ResponseEntity<ApiResponse<UserDto>> getMyInfo(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getMyInfo(userDetails.getUsername())));
    }

    /** User-01-2: 내 정보 수정 (사진, 이메일, 연락처, 생년월일, 이름) */
    @PatchMapping("/users/me")
    public ResponseEntity<ApiResponse<UserDto>> updateMyInfo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.updateMyInfo(userDetails.getUsername(), request)));
    }

    /** User-01-3: 비밀번호 변경 */
    @PatchMapping("/users/me/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.ok("비밀번호가 변경되었습니다."));
    }

    // ──────────────── 관리자 (Admin-01 ~ Admin-04) ────────────────

    /** Admin-01: 전체 회원 조회 */
    @GetMapping("/admin/users")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    /** Admin-01: 승인 대기 회원 목록 */
    @GetMapping("/admin/users/pending")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<List<UserDto>>> getPendingUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
    }

    /** Admin-02: 회원 단건 조회 */
    @GetMapping("/admin/users/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<UserDto>> getUserById(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserById(userId)));
    }

    /** Admin-02: 회원 승인 */
    @PatchMapping("/admin/users/{userId}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> approveUser(@PathVariable Long userId) {
        userService.approveUser(userId);
        return ResponseEntity.ok(ApiResponse.ok("회원 승인이 완료되었습니다."));
    }

    /** Admin-03: 회원 탈퇴(익명화 처리) */
    @DeleteMapping("/admin/users/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long userId) {
        userService.deleteUser(userId);
        return ResponseEntity.ok(ApiResponse.ok("회원이 탈퇴 처리되었습니다."));
    }

    /** Teamjang-01: 사번 수정 (관리자 전용) */
    @PatchMapping("/admin/users/{userId}/emp-no")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateEmpNo(
            @PathVariable Long userId,
            @RequestParam String empNo) {
        userService.updateEmpNo(userId, empNo);
        return ResponseEntity.ok(ApiResponse.ok("사번이 변경되었습니다."));
    }

    /** Teamjang-01: 역할(직급) 변경 (관리자 전용) */
    @PatchMapping("/admin/users/{userId}/role")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> changeUserRole(
            @PathVariable Long userId,
            @RequestParam Long scopeId,
            @RequestParam String roleName) {
        userService.changeUserRole(userId, scopeId, roleName);
        return ResponseEntity.ok(ApiResponse.ok("역할이 변경되었습니다."));
    }
}
