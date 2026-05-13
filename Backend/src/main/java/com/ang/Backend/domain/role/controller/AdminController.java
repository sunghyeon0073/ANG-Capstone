package com.ang.Backend.domain.role.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.role.dto.RoleUpdateRequest;
import com.ang.Backend.domain.role.entity.Role;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.domain.user.dto.UserApproveRequest;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import com.ang.Backend.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final ScopeService scopeService;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    @GetMapping("/users/pending")
    public ResponseEntity<ApiResponse<List<UserDto>>> getPendingUsers(@AuthenticationPrincipal UserDetails userDetails) {
        User admin = userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        List<UserRole> adminRoles = userRoleRepository.findByUserOrderByRoleLevelDesc(admin);
        if (adminRoles.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
        }

        // 가장 높은 권한의 스코프를 기준으로 하위 멤버들 조회
        Scope adminScope = adminRoles.get(0).getScope();

        // 최고관리자(Level 100)면 전체 조회, 아니면 하위 스코프 필터링
        if (adminRoles.get(0).getRole().getRoleLevel() >= 100) {
            return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
        }

        List<Integer> subScopeIds = scopeService.getAllSubScopeIds(adminScope);
        return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsersByScopes(subScopeIds)));
    }

    @PatchMapping("/users/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveUser(@PathVariable Integer id, 
                                                           @RequestBody UserApproveRequest req) {
        userService.approveUser(id, req.getRoleLevel());
        return ResponseEntity.ok(ApiResponse.ok("승인 완료되었습니다."));
    }

    @Transactional
    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<Void>> updateUserRole(@PathVariable Integer id,
                                                             @RequestBody RoleUpdateRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        Role role = roleRepository.findByRoleLevel(req.getRoleLevel())
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(getRoleName(req.getRoleLevel())).roleLevel(req.getRoleLevel()).build()));

        List<UserRole> existing = userRoleRepository.findByUser(user);
        if (existing.isEmpty()) {
            throw new CustomException(ErrorCode.ROLE_NOT_FOUND);
        }
        userRoleRepository.deleteAll(existing);
        userRoleRepository.save(new UserRole(user, existing.get(0).getScope(), role));
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
