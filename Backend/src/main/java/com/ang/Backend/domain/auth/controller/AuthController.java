package com.ang.Backend.domain.auth.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.auth.dto.LoginRequest;
import com.ang.Backend.domain.auth.dto.LoginResponse;
import com.ang.Backend.domain.auth.dto.RegisterRequest;
import com.ang.Backend.domain.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

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
}
