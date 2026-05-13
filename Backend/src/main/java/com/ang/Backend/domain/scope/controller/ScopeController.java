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

    @GetMapping("/{id}/members")
    public ResponseEntity<ApiResponse<List<UserDto>>> getScopeMembers(@PathVariable Integer id) {
        Scope scope = scopeRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        List<UserDto> members = userMembershipRepository.findByScope(scope).stream()
                .map(m -> userService.getUser(m.getUser().getUserId()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(members));
    }
}
