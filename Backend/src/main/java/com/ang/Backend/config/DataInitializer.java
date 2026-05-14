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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;

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
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            cleanupOldData();
            initRoles();
            initScopes();
            initUsers();
        };
    }

    private void cleanupOldData() {
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        try {
            // 기존 테스트용 옛날 부서들 삭제
            List<String> oldCodes = List.of("ANG-EDU-HR-01", "ANG-EDU-FIN-02", "ANG-EDU-OPS-03", "DEPT01", "DEPT02", "DEPT03");
            for (String code : oldCodes) {
                scopeRepository.findByScopeCode(code).ifPresent(scope -> {
                    jdbcTemplate.update("DELETE FROM user_roles WHERE scope_id = ?", scope.getScopeId());
                    jdbcTemplate.update("DELETE FROM user_memberships WHERE scope_id = ?", scope.getScopeId());
                    jdbcTemplate.update("DELETE FROM documents WHERE scope_id = ?", scope.getScopeId());
                    jdbcTemplate.update("DELETE FROM scopes WHERE scope_id = ?", scope.getScopeId());
                    log.info("[DataInitializer] 옛날 부서 삭제: {}", code);
                });
            }
            
            // 회사 이름 업데이트
            scopeRepository.findByScopeCode("COMPANY01").ifPresent(scope -> {
                scope.setName("영진전문대학교");
                scopeRepository.save(scope);
            });

            // 어드민 비밀번호 업데이트
            userRepository.findByEmpNo("admin").ifPresent(admin -> {
                admin.setPasswordHash(passwordEncoder.encode("qwer1234!"));
                userRepository.save(admin);
                log.info("[DataInitializer] admin 비밀번호를 qwer1234!로 변경했습니다.");
            });
            userRepository.findByEmpNo("manager").ifPresent(manager -> {
                manager.setPasswordHash(passwordEncoder.encode("qwer1234!"));
                manager.setName("김기종");
                manager.setPosition("원장");
                userRepository.save(manager);
                log.info("[DataInitializer] manager 계정 정보를 업데이트했습니다.");
            });
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    private void initRoles() {
        insertRoleIfAbsent(0,   "일반",      "일반 사용자 (팀원, 실무자)");
        insertRoleIfAbsent(50,  "관리자",     "부서 관리자 (팀장)");
        insertRoleIfAbsent(100, "최고관리자", "시스템 전체 운영자");
    }

    private void initScopes() {
        insertScopeIfAbsent("COMPANY01",      "영진전문대학교",   ScopeType.COMPANY,    null);
        insertScopeIfAbsent("DEPT_EDU",       "평생교육원",   ScopeType.DEPARTMENT, "COMPANY01");
        
        insertScopeIfAbsent("ANG-EDU-OP_COMM", "평생교육원 운영위원회", ScopeType.TEAM, "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-STAND_COMM", "상임위원", ScopeType.TEAM, "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-LONG_CARE", "장기요양교육센터", ScopeType.TEAM, "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-EMERGENCY", "응급구조교육센터", ScopeType.TEAM, "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-NATIONAL", "국고/일반과정(지역사회 협력·기여)", ScopeType.TEAM, "DEPT_EDU");
        insertScopeIfAbsent("ANG-EDU-ADMIN", "행정지원", ScopeType.TEAM, "DEPT_EDU");
    }

    private void initUsers() {
        // 1. 최고 관리자 (admin)
        insertUserIfAbsent("admin", "최고관리자", "admin@ang.com", 100, "COMPANY01", "시스템운영자", "qwer1234!");

        // 2. 평생교육원 원장님 (manager)
        insertUserIfAbsent("manager", "김기종", "manager@ang.com", 50, "DEPT_EDU", "원장", "qwer1234!");
    }

    private void insertUserIfAbsent(String empNo, String name, String email, int roleLevel, String scopeCode, String position, String password) {
        if (userRepository.existsByEmpNo(empNo)) return;

        User user = User.builder()
                .empNo(empNo)
                .passwordHash(passwordEncoder.encode(password))
                .name(name)
                .email(email)
                .birthdate(LocalDate.of(1980, 1, 1))
                .status(UserStatus.ACTIVE)
                .position(position)
                .build();
        userRepository.save(user);
        createFolder("Users", empNo);

        Scope scope = scopeRepository.findByScopeCode(scopeCode).orElseThrow();
        userMembershipRepository.save(UserMembership.builder().user(user).scope(scope).position(position).build());

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
