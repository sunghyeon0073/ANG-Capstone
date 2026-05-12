package com.ang.Backend.config;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.domain.role.entity.Role;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final RoleRepository roleRepository;
    private final ScopeRepository scopeRepository;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            initRoles();
            initScopes();
        };
    }

    private void initRoles() {
        insertRoleIfAbsent(0,   "일반",      "일반 사용자 (팀원, 실무자)");
        insertRoleIfAbsent(50,  "관리자",     "부서 관리자 (팀장)");
        insertRoleIfAbsent(100, "최고관리자", "시스템 전체 운영자");
    }

    private void initScopes() {
        insertScopeIfAbsent("COMPANY01", "ANG",        ScopeType.COMPANY,    null);
        insertScopeIfAbsent("DEPT01",    "뭐시기팀",     ScopeType.DEPARTMENT, "COMPANY01");
        insertScopeIfAbsent("DEPT02",    "뭐시기2팀",     ScopeType.DEPARTMENT, "COMPANY01");
        insertScopeIfAbsent("DEPT03",    "뭐시기3팀",   ScopeType.DEPARTMENT, "COMPANY01");
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
        log.info("[DataInitializer] 부서 생성: {} ({})", name, code);
    }
}
