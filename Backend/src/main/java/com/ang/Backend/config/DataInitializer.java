package com.ang.Backend.config;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.domain.role.entity.Role;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final RoleRepository roleRepository;
    private final ScopeRepository scopeRepository;
    private final UserRepository userRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            initRoles();
            initScopes();
            initUsers();
        };
    }

    private void initRoles() {
        insertRoleIfAbsent(0,   "일반",      "일반 사용자 (팀원, 실무자)");
        insertRoleIfAbsent(50,  "관리자",     "부서 관리자 (팀장)");
        insertRoleIfAbsent(100, "최고관리자", "시스템 전체 운영자");
    }

    private void initScopes() {
        insertScopeIfAbsent("COMPANY01",      "ANG",        ScopeType.COMPANY,    null);
        insertScopeIfAbsent("DEPT_EDU",       "평생교육원",   ScopeType.DEPARTMENT, "COMPANY01");
        
        // Level 3: 고유 식별 번호 부여
        insertScopeIfAbsent("ANG-EDU-HR-01",  "인사담당",     ScopeType.TEAM,       "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-FIN-02", "재무담당",     ScopeType.TEAM,       "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-OPS-03", "운영지원",     ScopeType.TEAM,       "DEPT_EDU");
    }

    private void initUsers() {
        // 1. 최고 관리자 (admin)
        insertUserIfAbsent("admin", "최고관리자", "admin@ang.com", 100, "COMPANY01", "시스템운영자");

        // 2. 평생교육원 원장님 (manager)
        insertUserIfAbsent("manager", "김원장", "manager@ang.com", 50, "DEPT_EDU", "원장");
    }

    private void insertUserIfAbsent(String empNo, String name, String email, int roleLevel, String scopeCode, String position) {
        if (userRepository.existsByEmpNo(empNo)) return;

        User user = User.builder()
                .empNo(empNo)
                .passwordHash(passwordEncoder.encode("Password123!"))
                .name(name)
                .email(email)
                .birthdate(LocalDate.of(1980, 1, 1))
                .status(UserStatus.ACTIVE) // 즉시 활성화
                .position(position)
                .build();
        userRepository.save(user);
        createFolder("Users", empNo);

        Scope scope = scopeRepository.findByScopeCode(scopeCode).orElseThrow();
        userMembershipRepository.save(UserMembership.builder().user(user).scope(scope).build());

        Role role = roleRepository.findByRoleLevel(roleLevel).orElseThrow();
        userRoleRepository.save(new UserRole(user, scope, role));

        log.info("[DataInitializer] 테스트 계정 생성: {} ({})", name, empNo);
    }

    private void insertRoleIfAbsent(int level, String name, String description) {
        if (roleRepository.findByRoleLevel(level).isEmpty()) {
            roleRepository.save(Role.builder()
                    .name(name)
                    .roleLevel(level)
                    .description(description)
                    .build());
            log.info("[DataInitializer] 역할 생성: {} (level={})", name, level);
        }
    }

    private void insertScopeIfAbsent(String code, String name, ScopeType type, String parentCode) {
        if (scopeRepository.existsByScopeCode(code)) return;

        Scope parent = parentCode != null
                ? scopeRepository.findByScopeCode(parentCode).orElse(null)
                : null;

        scopeRepository.save(Scope.builder()
                .scopeCode(code)
                .name(name)
                .scopeType(type)
                .parentScope(parent)
                .build());
        createFolder("Scopes", code);
        log.info("[DataInitializer] 부서 생성: {} ({})", name, code);
    }

    private void createFolder(String type, String code) {
        try {
            Path path = Paths.get("uploads", type, code);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (Exception e) {
            log.error("Failed to create folder for {}: {}", type, code);
        }
    }
}
