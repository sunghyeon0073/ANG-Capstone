package org.example.capstoneBack.domain.auth.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.auth.dto.*;
import org.example.capstoneBack.domain.role.entity.Role;
import org.example.capstoneBack.domain.role.repository.RoleRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.entity.UserMembership;
import org.example.capstoneBack.domain.user.entity.UserRole;
import org.example.capstoneBack.domain.user.repository.UserMembershipRepository;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.example.capstoneBack.domain.user.repository.UserRoleRepository;
import org.example.capstoneBack.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("^(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{6,24}$");

    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public void signUp(SignUpRequest request) {
        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "비밀번호가 일치하지 않습니다.");
        }
        if (!PASSWORD_PATTERN.matcher(request.getPassword()).matches()) {
            throw new CustomException(ErrorCode.PASSWORD_POLICY_VIOLATION);
        }
        if (userRepository.existsByEmpNo(request.getEmpNo())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMP_NO);
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMAIL);
        }

        Scope scope = scopeRepository.findByScopeCode(request.getScopeCode())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_SCOPE_CODE));

        User user = User.builder()
                .empNo(request.getEmpNo())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .email(request.getEmail())
                .birthdate(request.getBirthdate())
                .build();
        userRepository.save(user);

        UserMembership membership = UserMembership.builder()
                .user(user)
                .scope(scope)
                .build();
        userMembershipRepository.save(membership);

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
        userRoleRepository.save(UserRole.builder()
                .user(user)
                .scope(scope)
                .role(userRole)
                .build());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmpNo(request.getEmpNo())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_EMP_NO));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD);
        }
        if (user.getStatus() == org.example.capstoneBack.common.enums.UserStatus.PENDING) {
            throw new CustomException(ErrorCode.USER_PENDING);
        }
        if (user.getStatus() == org.example.capstoneBack.common.enums.UserStatus.ANONYMIZED) {
            throw new CustomException(ErrorCode.USER_ANONYMIZED);
        }

        String accessToken = jwtTokenProvider.createAccessToken(user.getEmpNo());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getEmpNo());

        int maxRoleLevel = user.getUserRoles().stream()
                .mapToInt(ur -> ur.getRole().getRoleLevel())
                .max().orElse(0);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(user.getUserId())
                .empNo(user.getEmpNo())
                .name(user.getName())
                .roleLevel(maxRoleLevel)
                .build();
    }

    @Transactional(readOnly = true)
    public LoginResponse refreshToken(TokenRefreshRequest request) {
        jwtTokenProvider.validateToken(request.getRefreshToken());
        String empNo = jwtTokenProvider.getEmpNoFromToken(request.getRefreshToken());
        User user = userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        String newAccessToken = jwtTokenProvider.createAccessToken(empNo);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(empNo);

        int maxRoleLevel = user.getUserRoles().stream()
                .mapToInt(ur -> ur.getRole().getRoleLevel())
                .max().orElse(0);

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .userId(user.getUserId())
                .empNo(empNo)
                .name(user.getName())
                .roleLevel(maxRoleLevel)
                .build();
    }
}
