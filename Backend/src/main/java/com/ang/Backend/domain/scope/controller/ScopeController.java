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
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getAllScopes() {
        List<ScopeDto> scopes = scopeRepository.findAll().stream()
                .map(ScopeDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(scopes));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ScopeDto>> createScope(@jakarta.validation.Valid @RequestBody com.ang.Backend.domain.scope.dto.ScopeCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.createScope(request)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getMyScopes(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        
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
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {
        com.ang.Backend.domain.user.entity.User requester = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        scopeService.addMemberToScope(id, userId, requester);
        return ResponseEntity.ok(ApiResponse.ok("부서 멤버로 추가되었습니다."));
    }
}
