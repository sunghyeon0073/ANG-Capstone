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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

        Scope scope = scopeRepository.findByScopeCode(req.getScopeCode())
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        if (scope.getScopeType() != com.ang.Backend.common.enums.ScopeType.TEAM) {
            throw new CustomException(ErrorCode.ONLY_TEAM_REGISTRATION_ALLOWED);
        }

        User user = User.builder()
                .empNo(req.getEmpNo())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .email(req.getEmail())
                .birthdate(req.getBirthdate())
                .status(UserStatus.PENDING)
                .build();
        userRepository.save(user);
        createPhysicalUserFolder(user.getEmpNo());

        userMembershipRepository.save(UserMembership.builder()
                .user(user)
                .scope(scope)
                .build());

        Role defaultRole = roleRepository.findByRoleLevel(0)
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
        userRoleRepository.save(new UserRole(user, scope, defaultRole));
    }

    private void createPhysicalUserFolder(String empNo) {
        try {
            Path path = Paths.get("uploads", "Users", empNo);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                log.info("Created physical directory for user: {}", path);
            }
        } catch (IOException e) {
            log.error("Failed to create directory for user: {}", empNo, e);
        }
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
}
