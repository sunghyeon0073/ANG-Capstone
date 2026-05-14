package com.ang.Backend.domain.scope.controller;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.scope.dto.ScopeDto;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.domain.user.dto.UserDto;
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
@RequestMapping("/scopes")
@RequiredArgsConstructor
public class ScopeController {

    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserService userService;
    private final ScopeService scopeService;
    private final UserRepository userRepository;
    private final com.ang.Backend.domain.role.repository.UserRoleRepository userRoleRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getAllScopes() {
        List<ScopeDto> scopes = scopeRepository.findAll().stream()
                .map(ScopeDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(scopes));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ScopeDto>> createScope(
            @jakarta.validation.Valid @RequestBody com.ang.Backend.domain.scope.dto.ScopeCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        requireAdmin(getRequester(userDetails));
        return ResponseEntity.ok(ApiResponse.ok(scopeService.createScope(request)));
    }

    @GetMapping("/my")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getMyScopes(@AuthenticationPrincipal UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User user = getRequester(userDetails);
        
        // 최고관리자(100)면 전체 부서 조회, 아니면 본인 소속 부서만 조회
        List<com.ang.Backend.domain.role.entity.UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        
        boolean isSuperAdmin = roles.stream().anyMatch(r -> r.getRole().getRoleLevel() >= 100);
        
        List<ScopeDto> scopes;
        if (isSuperAdmin) {
            scopes = scopeRepository.findAll().stream()
                    .map(ScopeDto::from)
                    .collect(Collectors.toList());
        } else {
            scopes = userMembershipRepository.findByUser(user).stream()
                    .map(m -> ScopeDto.from(m.getScope()))
                    .collect(Collectors.toList());
        }
        return ResponseEntity.ok(ApiResponse.ok(scopes));
    }

    @GetMapping("/{id}/members")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<UserDto>>> getScopeMembers(@PathVariable Integer id) {
        Scope scope = scopeRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        List<UserDto> members = userMembershipRepository.findByScope(scope).stream()
                .map(m -> userService.getUser(m.getUser().getUserId()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(members));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ApiResponse<Void>> addMemberToScope(
            @PathVariable Integer id,
            @RequestParam Integer userId,
            @RequestParam(required = false) String position,
            @AuthenticationPrincipal UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User requester = getRequester(userDetails);
        scopeService.addMemberToScope(id, userId, position, requester);
        return ResponseEntity.ok(ApiResponse.ok("부서 멤버로 추가되었습니다."));
    }

    @PatchMapping("/{id}/members/{userId}/position")
    public ResponseEntity<ApiResponse<Void>> updateMemberPosition(
            @PathVariable Integer id,
            @PathVariable Integer userId,
            @RequestBody com.ang.Backend.domain.scope.dto.MemberPositionUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User requester = getRequester(userDetails);
        scopeService.updateMemberPosition(id, userId, request.getPosition(), requester);
        return ResponseEntity.ok(ApiResponse.ok("직급이 변경되었습니다."));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeMemberFromScope(
            @PathVariable Integer id,
            @PathVariable Integer userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User requester = getRequester(userDetails);
        scopeService.removeMemberFromScope(id, userId, requester);
        return ResponseEntity.ok(ApiResponse.ok("부서 소속이 해제되었습니다."));
    }

    private com.ang.Backend.domain.user.entity.User getRequester(UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private void requireAdmin(com.ang.Backend.domain.user.entity.User requester) {
        int maxRoleLevel = userRoleRepository.findByUserOrderByRoleLevelDesc(requester).stream()
                .mapToInt(userRole -> userRole.getRole().getRoleLevel())
                .max()
                .orElse(0);
        if (maxRoleLevel < 50) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
    }
}
