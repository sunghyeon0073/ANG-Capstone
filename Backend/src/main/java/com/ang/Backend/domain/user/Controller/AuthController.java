package com.ang.Backend.domain.user.Controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.user.DTO.LoginRequest;
import com.ang.Backend.domain.user.DTO.LoginResponse;
import com.ang.Backend.domain.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }
}
