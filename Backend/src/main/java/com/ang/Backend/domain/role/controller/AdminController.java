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
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
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

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final ScopeService scopeService;

    @GetMapping("/users")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers(@AuthenticationPrincipal UserDetails userDetails) {
        User admin = getRequester(userDetails);
        List<UserRole> adminRoles = requireAdminRoles(admin);
        UserRole highestRole = adminRoles.get(0);
        if (highestRole.getRole().getRoleLevel() >= 100) {
            return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
        }

        List<Integer> subScopeIds = scopeService.getAllSubScopeIds(highestRole.getScope());
        return ResponseEntity.ok(ApiResponse.ok(userService.getUsersByScopes(subScopeIds)));
    }

    @GetMapping("/users/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<UserDto>>> getPendingUsers(@AuthenticationPrincipal UserDetails userDetails) {
        User admin = getRequester(userDetails);

        List<UserRole> adminRoles = requireAdminRoles(admin);

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
    @Transactional
    public ResponseEntity<ApiResponse<Void>> approveUser(@PathVariable Integer id, 
                                                           @RequestBody com.ang.Backend.domain.user.dto.UserApproveRequest req,
                                                           @AuthenticationPrincipal UserDetails userDetails) {
        if (req.getRoleLevel() == null) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        User admin = getRequester(userDetails);
        requireCanManage(admin, id, req.getRoleLevel(), false);
        userService.approveUser(id, req.getRoleLevel(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.ok("승인 완료되었습니다."));
    }

    @PatchMapping("/users/{id}/reject")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> rejectUser(@PathVariable Integer id,
                                                         @RequestBody com.ang.Backend.domain.user.dto.UserRejectRequest req,
                                                         @AuthenticationPrincipal UserDetails userDetails) {
        User admin = getRequester(userDetails);
        requireCanManage(admin, id, null, false);
        userService.rejectUser(id, req.getReason());
        return ResponseEntity.ok(ApiResponse.ok("거절 처리되었습니다."));
    }

    @Transactional
    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<Void>> updateUserRole(@PathVariable Integer id,
                                                             @RequestBody RoleUpdateRequest req,
                                                             @AuthenticationPrincipal UserDetails userDetails) {
        if (req.getRoleLevel() == null) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }
        User admin = getRequester(userDetails);
        requireCanManage(admin, id, req.getRoleLevel(), true);

        User user = userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        Role role = roleRepository.findByRoleLevel(req.getRoleLevel())
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(getRoleName(req.getRoleLevel())).roleLevel(req.getRoleLevel()).build()));

        List<UserRole> existing = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        if (existing.isEmpty()) {
            throw new CustomException(ErrorCode.ROLE_NOT_FOUND);
        }
        userRoleRepository.deleteAll(existing);
        userRoleRepository.save(new UserRole(user, existing.get(0).getScope(), role));
        return ResponseEntity.ok(ApiResponse.ok("권한이 변경되었습니다."));
    }

    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Integer id,
                                                        @AuthenticationPrincipal UserDetails userDetails) {
        User admin = getRequester(userDetails);
        requireCanManage(admin, id, null, true);
        userService.anonymize(id);
        return ResponseEntity.ok(ApiResponse.ok("회원 탈퇴 처리되었습니다."));
    }

    private String getRoleName(int level) {
        return level >= 100 ? "최고관리자" : level >= 50 ? "관리자" : "일반 사용자";
    }

    private User getRequester(UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private void requireAdmin(User requester) {
        if (getMaxRoleLevel(requester) < 50) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
    }

    private List<UserRole> requireAdminRoles(User requester) {
        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(requester);
        if (roles.isEmpty() || roles.get(0).getRole().getRoleLevel() < 50) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        return roles;
    }

    private void requireCanManage(User requester, Integer targetUserId, Integer requestedRoleLevel, boolean blockSelf) {
        int requesterLevel = getMaxRoleLevel(requester);
        if (requesterLevel < 50) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (requestedRoleLevel == null && !blockSelf) {
            requestedRoleLevel = 0;
        }
        if (requestedRoleLevel != null && requestedRoleLevel > requesterLevel) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (blockSelf && requester.getUserId().equals(target.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        int targetLevel = getMaxRoleLevel(target);
        if (targetLevel > requesterLevel) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (requesterLevel < 100 && !isInRequesterScope(requester, target)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
    }

    private int getMaxRoleLevel(User user) {
        return userRoleRepository.findByUserOrderByRoleLevelDesc(user).stream()
                .mapToInt(userRole -> userRole.getRole().getRoleLevel())
                .max()
                .orElse(0);
    }

    private boolean isInRequesterScope(User requester, User target) {
        List<Integer> allowedScopeIds = userRoleRepository.findByUserOrderByRoleLevelDesc(requester).stream()
                .filter(userRole -> userRole.getRole().getRoleLevel() >= 50)
                .flatMap(userRole -> scopeService.getAllSubScopeIds(userRole.getScope()).stream())
                .distinct()
                .toList();

        return userMembershipRepository.findByUser(target).stream()
                .map(UserMembership::getScope)
                .anyMatch(scope -> allowedScopeIds.contains(scope.getScopeId()));
    }
}
