package org.example.capstoneBack.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.capstoneBack.common.enums.ScopeType;
import org.example.capstoneBack.common.enums.UserStatus;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final RoleRepository roleRepository;
    private final ScopeRepository scopeRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.init.password}")
    private String adminInitPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        initRoles();
        initDefaultScope();
        initSuperAdmin();
    }

    private void initRoles() {
        if (roleRepository.count() > 0) return;

        roleRepository.save(Role.builder()
                .name("ROLE_USER")
                .roleLevel(0)
                .description("일반 사용자 (팀원, 실무자)")
                .build());

        roleRepository.save(Role.builder()
                .name("ROLE_ADMIN")
                .roleLevel(50)
                .description("부서 관리자 (팀장)")
                .build());

        roleRepository.save(Role.builder()
                .name("ROLE_SUPERADMIN")
                .roleLevel(100)
                .description("최고 관리자 (시스템 운영자)")
                .build());

        log.info("[DataInitializer] 기본 역할(Role) 3종 생성 완료");
    }

    private void initDefaultScope() {
        if (scopeRepository.existsByScopeCode("COMPANY-001")) return;

        scopeRepository.save(Scope.builder()
                .scopeType(ScopeType.COMPANY)
                .scopeCode("COMPANY-001")
                .name("ANG 본사")
                .build());

        log.info("[DataInitializer] 기본 조직(Scope) 생성 완료: COMPANY-001");
    }

    private void initSuperAdmin() {
        if (userRepository.existsByEmpNo("ADMIN001")) return;

        Scope companyScope = scopeRepository.findByScopeCode("COMPANY-001")
                .orElseThrow(() -> new IllegalStateException("기본 Scope 없음"));

        Role superAdminRole = roleRepository.findByName("ROLE_SUPERADMIN")
                .orElseThrow(() -> new IllegalStateException("ROLE_SUPERADMIN 없음"));

        User superAdmin = User.builder()
                .empNo("ADMIN001")
                .passwordHash(passwordEncoder.encode(adminInitPassword))
                .name("시스템관리자")
                .email("admin@ang.com")
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(superAdmin);

        userMembershipRepository.save(UserMembership.builder()
                .user(superAdmin)
                .scope(companyScope)
                .build());

        userRoleRepository.save(UserRole.builder()
                .user(superAdmin)
                .scope(companyScope)
                .role(superAdminRole)
                .build());

        log.info("[DataInitializer] 최고 관리자 계정 생성: empNo=ADMIN001");
    }
}
