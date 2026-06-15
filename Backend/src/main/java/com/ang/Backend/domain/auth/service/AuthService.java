package com.ang.Backend.domain.auth.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.auth.dto.LoginRequest;
import com.ang.Backend.domain.auth.dto.LoginResponse;
import com.ang.Backend.domain.auth.dto.RegisterRequest;
import com.ang.Backend.domain.role.entity.Role;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import com.ang.Backend.domain.user.service.UserService;
import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("^(?=.*[a-zA-Z])(?=.*[^a-zA-Z0-9]).{6,24}$");

    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserService userService;

    @Transactional
    public void register(RegisterRequest req) {
        if (userRepository.existsByEmpNo(req.getEmpNo())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMP_NO);
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMAIL);
        }
        if (!req.getPassword().equals(req.getPasswordConfirm())) {
            throw new CustomException(ErrorCode.PASSWORD_MISMATCH);
        }
        if (!PASSWORD_PATTERN.matcher(req.getPassword()).matches()) {
            throw new CustomException(ErrorCode.PASSWORD_POLICY_VIOLATION);
        }

        Scope scope = scopeRepository.findById(req.getScopeId())
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        User user = User.builder()
                .empNo(req.getEmpNo())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .email(req.getEmail())
                .birthdate(req.getBirthdate())
                .status(UserStatus.PENDING)
                .position("사원") // Default position
                .build();
        userRepository.save(user);
        createPhysicalUserFolder(user.getEmpNo());

        // Create membership for the scope
        userMembershipRepository.save(UserMembership.builder()
                .user(user)
                .scope(scope)
                .position("사원") // Default position
                .build());

        Role defaultRole = roleRepository.findByRoleLevel(1)
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
        
        userRoleRepository.save(new UserRole(user, scope, defaultRole));
    }

    private void createPhysicalUserFolder(String empNo) {
        log.debug("Skipping local user directory creation for {} because files are stored in S3", empNo);
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByEmpNo(req.getEmpNo())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_EMP_NO));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD);
        }

        if (user.getStatus() == UserStatus.PENDING) {
            throw new CustomException(ErrorCode.USER_PENDING);
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            throw new CustomException(ErrorCode.USER_REJECTED,
                    "가입이 거절되었습니다. 사유: " + user.getRejectionReason());
        }
        if (user.getStatus() == UserStatus.ANONYMIZED) {
            throw new CustomException(ErrorCode.USER_ANONYMIZED);
        }

        return LoginResponse.builder()
                .accessToken(jwtTokenProvider.createAccessToken(user.getEmpNo()))
                .refreshToken(jwtTokenProvider.createRefreshToken(user.getEmpNo()))
                .tokenType("Bearer")
                .user(userService.toDto(user))
                .build();
    }

    @Transactional(readOnly = true)
    public LoginResponse refresh(String refreshToken) {
        // 1. 토큰 유효성 검증
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        // 2. 사번 추출
        String empNo = jwtTokenProvider.getEmpNoFromToken(refreshToken);
        
        // 3. 사용자 존재 및 상태 확인
        User user = userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new CustomException(ErrorCode.FORBIDDEN, "활성화된 사용자가 아닙니다.");
        }

        // 4. 새로운 Access Token 발급
        return LoginResponse.builder()
                .accessToken(jwtTokenProvider.createAccessToken(user.getEmpNo()))
                .refreshToken(refreshToken) // 기존 리프레시 토큰 유지
                .tokenType("Bearer")
                .user(userService.toDto(user))
                .build();
    }
}
