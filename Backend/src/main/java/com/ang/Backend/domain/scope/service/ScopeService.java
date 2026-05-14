package com.ang.Backend.domain.scope.service;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.scope.dto.ScopeDto;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.entity.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScopeService {

    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;

    /**
     * [재귀적 조직 탐색 로직]
     * 특정 부서를 선택했을 때, 그 부서에 속한 모든 하위 부서의 ID를 재귀적으로 수집합니다.
     * 관리자가 본인의 관할 범위를 파악할 때 사용되는 핵심 알고리즘입니다.
     */
    public List<Integer> getAllSubScopeIds(Scope scope) {
        List<Integer> ids = new ArrayList<>();
        ids.add(scope.getScopeId()); // 현재 부서 ID 추가
        
        List<Scope> children = scopeRepository.findByParentScope(scope);
        for (Scope child : children) {
            // 자식 부서들에 대해 다시 이 메소드를 호출하여 리스트를 합칩니다.
            ids.addAll(getAllSubScopeIds(child));
        }
        return ids;
    }

    /**
     * [새로운 부서(Scope) 생성 로직]
     * 조직도에 새로운 팀이나 부서를 추가하고, 실제 파일 저장 공간을 서버에 생성합니다.
     */
    @Transactional
    public ScopeDto createScope(com.ang.Backend.domain.scope.dto.ScopeCreateRequest request) {
        Scope parent = null;
        
        // 1. 상속 구조 설정: '최상위 회사'가 아니면 반드시 부모 부서가 있어야 합니다.
        if (request.getType() != ScopeType.COMPANY) {
            if (request.getParentId() == null) {
                throw new CustomException(ErrorCode.PARENT_SCOPE_REQUIRED);
            }
            parent = scopeRepository.findById(request.getParentId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }

        // 2. 중복 체크: 동일한 부서 코드가 존재하는지 확인 (예: DEPT01 중복 불가)
        if (scopeRepository.existsByScopeCode(request.getScopeCode())) {
            throw new CustomException(ErrorCode.DUPLICATE_SCOPE_CODE);
        }

        // 3. DB 엔티티 생성 및 저장
        Scope scope = Scope.builder()
                .name(request.getName())
                .scopeType(request.getType())
                .parentScope(parent)
                .scopeCode(request.getScopeCode())
                .build();

        Scope savedScope = scopeRepository.save(scope);

        // 4. 물리적 저장소 생성: 이 부서 사람들이 사용할 실제 폴더를 서버 하드디스크에 만듭니다.
        createPhysicalScopeFolder(savedScope.getScopeCode());

        return ScopeDto.from(savedScope);
    }

    /**
     * [사용자 부서 추가 로직 (다중 소속 지원)]
     * 이미 가입된 사용자를 특정 부서의 멤버로 새롭게 등록합니다.
     * 한 사용자가 본부, 팀, TF 등 여러 조직에 동시에 속할 수 있게 하는 핵심 기능입니다.
     * 
     * [데이터 흐름]
     * 1. 관리자가 대상 부서, 대상 사용자, 부여할 직급을 선택하여 요청
     * 2. 관리자의 권한(isManagerOfScope)을 확인하여 적절한 권한이 있는지 검증
     * 3. UserMembership 테이블에 유저-부서-직급 연결 정보 저장
     * 4. UserRole 테이블에 해당 부서에서 행사할 수 있는 기본 권한(Level 0) 저장
     */
    @Transactional
    public void addMemberToScope(Integer scopeId, Integer userId, String position, User requester) {
        // 1. 대상 부서 및 사용자 존재 여부 확인
        Scope targetScope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 2. 관리 권한 체크: 요청자가 대상 부서의 관리자이거나 최고관리자인지 확인
        if (!isManagerOfScope(requester, targetScope)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        // 3. 중복 소속 방지: 동일 부서에 이미 속해있는지 체크
        if (userMembershipRepository.existsByUserAndScope(targetUser, targetScope)) {
            throw new CustomException(ErrorCode.ALREADY_MEMBER);
        }

        // 4. 새로운 부서 소속(Membership) 정보 저장
        // 사용자는 이로써 새로운 부서와 연결되며, 해당 부서에서의 고유 직급을 갖게 됩니다.
        userMembershipRepository.save(UserMembership.builder()
                .user(targetUser)
                .scope(targetScope)
                .position(position != null && !position.trim().isEmpty() ? position : "사원")
                .build());

        // 5. 해당 부서용 기본 역할(Role) 부여
        // 다중 소속 시 부서별로 다른 권한 레벨을 가질 수 있는 구조의 기초가 됩니다.
        Role defaultRole = roleRepository.findByRoleLevel(0)
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));

        userRoleRepository.save(new UserRole(targetUser, targetScope, defaultRole));

        log.info("사용자 부서 추가 완료: 사번 {}, 부서 {}, 처리자 {}", targetUser.getEmpNo(), targetScope.getScopeCode(), requester.getEmpNo());
    }

    /**
     * 특정 부서에서의 멤버 직급을 업데이트합니다.
     */
    @Transactional
    public void updateMemberPosition(Integer scopeId, Integer userId, String position, User requester) {
        Scope targetScope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        if (!isManagerOfScope(requester, targetScope)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        UserMembership membership = userMembershipRepository.findByUserAndScope(targetUser, targetScope)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        membership.setPosition(position);
        userMembershipRepository.save(membership);
        
        log.info("User {} position in scope {} updated to {} by manager {}", targetUser.getEmpNo(), targetScope.getScopeCode(), position, requester.getEmpNo());
    }

    /**
     * 특정 부서에서 멤버를 제거합니다.
     */
    @Transactional
    public void removeMemberFromScope(Integer scopeId, Integer userId, User requester) {
        Scope targetScope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        if (!isManagerOfScope(requester, targetScope)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        // 최소 하나의 부서는 유지해야 함
        long membershipCount = userMembershipRepository.findByUser(targetUser).size();
        if (membershipCount <= 1) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "최소 하나의 부서 소속은 유지해야 합니다.");
        }

        UserMembership membership = userMembershipRepository.findByUserAndScope(targetUser, targetScope)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        userMembershipRepository.delete(membership);
        
        // 해당 부서에서 부여된 역할도 삭제
        userRoleRepository.deleteByUserAndScope(targetUser, targetScope);

        log.info("User {} removed from scope {} by manager {}", targetUser.getEmpNo(), targetScope.getScopeCode(), requester.getEmpNo());
    }

    private boolean isManagerOfScope(User user, Scope targetScope) {
        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        if (roles.stream().anyMatch(r -> r.getRole().getRoleLevel() >= 100)) return true;

        return roles.stream()
                .filter(r -> r.getRole().getRoleLevel() >= 50)
                .anyMatch(r -> isSameOrParent(r.getScope(), targetScope));
    }

    private boolean isSameOrParent(Scope potentialParent, Scope target) {
        if (potentialParent.getScopeId().equals(target.getScopeId())) return true;
        Scope current = target.getParentScope();
        while (current != null) {
            if (current.getScopeId().equals(potentialParent.getScopeId())) return true;
            current = current.getParentScope();
        }
        return false;
    }

    private void createPhysicalScopeFolder(String scopeCode) {
        try {
            Path path = Paths.get("uploads", "Scopes", scopeCode);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                log.info("Created physical directory for scope: {}", path);
            }
        } catch (IOException e) {
            log.error("Failed to create directory for scope: {}", scopeCode, e);
        }
    }
}
