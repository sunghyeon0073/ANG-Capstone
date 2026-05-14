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
import com.ang.Backend.domain.user.dto.UserRejectRequest;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import com.ang.Backend.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 전용 기능을 처리하는 컨트롤러 클래스
 * 사용자 관리, 가입 승인/거절, 권한 변경 등의 기능을 포함합니다.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')") // ROLE_ADMIN 권한을 가진 사용자만 이 컨트롤러의 모든 API에 접근 가능
public class AdminController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final ScopeService scopeService;

    /**
     * 시스템의 모든 사용자 목록을 조회합니다.
     * (탈퇴한 사용자는 제외됨)
     */
    @GetMapping("/users")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    /**
     * 관리자가 승인해야 할 가입 대기자 목록을 조회합니다.
     * 관리자의 권한 레벨에 따라 관할 부서의 대기자만 필터링하여 보여줍니다.
     */
    @GetMapping("/users/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<UserDto>>> getPendingUsers(@AuthenticationPrincipal UserDetails userDetails) {
        // 현재 로그인한 관리자 정보 조회
        User admin = userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 관리자의 권한 정보(부서 및 레벨) 조회
        List<UserRole> adminRoles = userRoleRepository.findByUserOrderByRoleLevelDesc(admin);
        if (adminRoles.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
        }

        // 관리자의 주 부서(가장 높은 권한이 있는 부서) 확인
        Scope adminScope = adminRoles.get(0).getScope();

        // 최고관리자(RoleLevel 100 이상)인 경우 전체 대기자 목록 반환
        if (adminRoles.get(0).getRole().getRoleLevel() >= 100) {
            return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsers()));
        }

        // 일반 관리자인 경우, 본인 부서 및 하위 부서의 대기자만 조회
        List<Integer> subScopeIds = scopeService.getAllSubScopeIds(adminScope);
        return ResponseEntity.ok(ApiResponse.ok(userService.getPendingUsersByScopes(subScopeIds)));
    }

    /**
     * 대기 중인 사용자의 가입을 승인합니다.
     * 승인 시 해당 사용자의 직급과 권한 레벨이 결정됩니다.
     */
    @PatchMapping("/users/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveUser(@PathVariable Integer id, 
                                                           @RequestBody UserApproveRequest req) {
        // UserService를 통해 상태 변경 및 권한 부여 로직 실행
        userService.approveUser(id, req.getRoleLevel(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.ok("승인 완료되었습니다."));
    }

    /**
     * 가입 요청을 거절합니다.
     * 거절 사유를 함께 기록하여 사용자에게 알릴 수 있습니다.
     */
    @PatchMapping("/users/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectUser(@PathVariable Integer id,
                                                         @RequestBody UserRejectRequest req) {
        userService.rejectUser(id, req.getReason());
        return ResponseEntity.ok(ApiResponse.ok("거절 처리되었습니다."));
    }

    /**
     * 이미 가입된 사용자의 권한(Role)을 업데이트합니다.
     */
    @Transactional
    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<Void>> updateUserRole(@PathVariable Integer id,
                                                             @RequestBody RoleUpdateRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 요청된 레벨의 역할(Role)이 없으면 새로 생성, 있으면 조회
        Role role = roleRepository.findByRoleLevel(req.getRoleLevel())
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(getRoleName(req.getRoleLevel())).roleLevel(req.getRoleLevel()).build()));

        // 기존 권한 삭제 후 새로운 권한 저장 (부서는 유지)
        List<UserRole> existing = userRoleRepository.findByUser(user);
        if (existing.isEmpty()) {
            throw new CustomException(ErrorCode.ROLE_NOT_FOUND);
        }
        userRoleRepository.deleteAll(existing);
        userRoleRepository.save(new UserRole(user, existing.get(0).getScope(), role));
        return ResponseEntity.ok(ApiResponse.ok("권한이 변경되었습니다."));
    }

    /**
     * 사용자를 시스템에서 탈퇴 처리합니다.
     * (DB 실제 삭제가 아닌 개인정보 익명화 처리)
     */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Integer id) {
        userService.anonymize(id);
        return ResponseEntity.ok(ApiResponse.ok("회원 탈퇴 처리되었습니다."));
    }

    /**
     * 레벨 숫자에 따른 역할 이름을 반환하는 내부 헬퍼 메소드
     */
    private String getRoleName(int level) {
        return level >= 100 ? "최고관리자" : level >= 50 ? "관리자" : "일반 사용자";
    }
}
