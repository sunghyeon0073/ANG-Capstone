package com.ang.Backend.domain.user.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.user.dto.RoleUpdateRequest;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.entity.Role;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.entity.UserRole;
import com.ang.Backend.domain.user.repository.RoleRepository;
import com.ang.Backend.domain.user.repository.UserRepository;
import com.ang.Backend.domain.user.repository.UserRoleRepository;
import com.ang.Backend.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    @GetMapping("/users/pending")
    public ResponseEntity<ApiResponse<List<UserDto>>> getPendingUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
    }

    @PatchMapping("/users/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveUser(@PathVariable Integer id) {
        userService.approveUser(id);
        return ResponseEntity.ok(ApiResponse.ok("승인 완료되었습니다."));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<Void>> updateUserRole(@PathVariable Integer id,
                                                             @RequestBody RoleUpdateRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        Role role = roleRepository.findByRoleLevel(req.getRoleLevel())
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(getRoleName(req.getRoleLevel())).roleLevel(req.getRoleLevel()).build()));

        List<UserRole> existing = userRoleRepository.findByUser(user);
        userRoleRepository.deleteAll(existing);

        if (!existing.isEmpty()) {
            userRoleRepository.save(new UserRole(user, existing.get(0).getScope(), role));
        }
        return ResponseEntity.ok(ApiResponse.ok("권한이 변경되었습니다."));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Integer id) {
        userService.anonymize(id);
        return ResponseEntity.ok(ApiResponse.ok("회원 탈퇴 처리되었습니다."));
    }

    private String getRoleName(int level) {
        return level >= 100 ? "최고관리자" : level >= 50 ? "관리자" : "일반 사용자";
    }
}
