package com.ang.Backend.domain.user.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.user.dto.ScopeDto;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.entity.Scope;
import com.ang.Backend.domain.user.repository.ScopeRepository;
import com.ang.Backend.domain.user.repository.UserMembershipRepository;
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

    @GetMapping
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getAllScopes() {
        List<ScopeDto> scopes = scopeRepository.findAll().stream()
                .map(ScopeDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(scopes));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<ApiResponse<List<UserDto>>> getScopeMembers(@PathVariable Integer id) {
        Scope scope = scopeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("부서를 찾을 수 없습니다."));
        List<UserDto> members = userMembershipRepository.findByScope(scope).stream()
                .map(m -> userService.getUser(m.getUser().getUserId()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(members));
    }
}
