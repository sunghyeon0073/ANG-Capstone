package com.ang.Backend.domain.auth.controller;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.auth.dto.LoginRequest;
import com.ang.Backend.domain.auth.dto.LoginResponse;
import com.ang.Backend.domain.auth.dto.RegisterRequest;
import com.ang.Backend.domain.auth.service.AuthService;
import com.ang.Backend.domain.scope.dto.ScopeDto;
import com.ang.Backend.domain.scope.dto.ScopeTreeDto;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final ScopeRepository scopeRepository;
    private final ScopeService scopeService;

    @GetMapping("/scopes/tree")
    public ResponseEntity<ApiResponse<List<ScopeTreeDto>>> getScopesTree() {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.getScopeTree()));
    }

    @GetMapping("/scopes")
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getPublicScopes() {
        List<ScopeDto> scopes = scopeRepository.findAll().stream()
                .filter(s -> s.getScopeType() == ScopeType.DEPARTMENT)
                .map(ScopeDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(scopes));
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ApiResponse.ok("회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.");
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@Valid @RequestBody com.ang.Backend.domain.auth.dto.RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request.getRefreshToken()));
    }
}
