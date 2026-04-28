package org.example.capstoneBack.domain.auth.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.auth.dto.LoginRequest;
import org.example.capstoneBack.domain.auth.dto.LoginResponse;
import org.example.capstoneBack.domain.auth.dto.SignUpRequest;
import org.example.capstoneBack.domain.auth.dto.TokenRefreshRequest;
import org.example.capstoneBack.domain.auth.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** Auth-03: 사번 + 부서코드 자가 가입 */
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<Void>> signUp(@Valid @RequestBody SignUpRequest request) {
        authService.signUp(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다."));
    }

    /** Auth-01: 사번 + 비밀번호 로그인 → JWT 발급 */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    /** JWT 재발급 */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
            @Valid @RequestBody TokenRefreshRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refreshToken(request)));
    }

}
