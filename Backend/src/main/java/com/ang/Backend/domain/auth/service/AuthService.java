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

    // 회원가입: User + UserMembership + UserRole 세 행을 하나의 트랜잭션으로 생성
    @Transactional
    public void register(RegisterRequest req) {

        // 중복 체크 — 같은 사번/이메일 재사용 불가
        if (userRepository.existsByEmpNo(req.getEmpNo())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMP_NO);
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new CustomException(ErrorCode.DUPLICATE_EMAIL);
        }

        // 비밀번호 일치 + 정책 검증: 영문 + 특수문자 포함, 6~24자
        if (!req.getPassword().equals(req.getPasswordConfirm())) {
            throw new CustomException(ErrorCode.PASSWORD_MISMATCH);
        }
        if (!PASSWORD_PATTERN.matcher(req.getPassword()).matches()) {
            throw new CustomException(ErrorCode.PASSWORD_POLICY_VIOLATION);
        }

        // 가입 시 입력한 부서코드(scopeCode)가 실제 존재하는 Scope인지 검증
        Scope scope = scopeRepository.findByScopeCode(req.getScopeCode())
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        // User 저장 — 비밀번호는 BCrypt 해싱, status=PENDING(관리자 승인 전까지 로그인 불가)
        User user = User.builder()
                .empNo(req.getEmpNo())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .email(req.getEmail())
                .birthdate(req.getBirthdate())
                .status(UserStatus.PENDING)
                .build();
        userRepository.save(user);

        // 개인 파일 디렉토리 생성: uploads/Users/{사번}/
        createPhysicalUserFolder(user.getEmpNo());

        // 부서 소속(UserMembership) 생성 — 기본 직책 "사원"
        userMembershipRepository.save(UserMembership.builder()
                .user(user)
                .scope(scope)
                .position("사원")
                .build());

        // 부서별 역할(UserRole) 생성 — 기본 roleLevel=0 (최하위 권한)
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

    // 로그인: 사번+비번 검증 후 JWT accessToken(30분) + refreshToken(7일) 발급
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        // 사번으로 조회 (없으면 INVALID_EMP_NO)
        User user = userRepository.findByEmpNo(req.getEmpNo())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_EMP_NO));

        // BCrypt 비교: 입력 평문 vs DB 해시 (salt 포함 자동 비교)
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD);
        }

        // 계정 상태 체크
        // PENDING   → 관리자 승인 전 (로그인 불가)
        // REJECTED  → 가입 거절됨, 거절 사유를 응답에 포함
        // ANONYMIZED → 개인정보 삭제된 탈퇴 계정
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

        // JWT 발급 — subject(sub 클레임) = 사번(empNo)
        return LoginResponse.builder()
                .accessToken(jwtTokenProvider.createAccessToken(user.getEmpNo()))
                .refreshToken(jwtTokenProvider.createRefreshToken(user.getEmpNo()))
                .tokenType("Bearer")
                .user(userService.toDto(user))
                .build();
    }
}
