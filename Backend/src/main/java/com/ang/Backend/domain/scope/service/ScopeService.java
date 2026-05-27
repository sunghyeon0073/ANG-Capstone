package com.ang.Backend.domain.scope.service;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.scope.dto.ScopeDto;
import com.ang.Backend.domain.scope.dto.ScopeTreeDto;
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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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
     * 자신을 포함한 모든 하위 스코프 ID 목록을 재귀적으로 조회합니다.
     */
    public List<Integer> getAllSubScopeIds(Scope scope) {
        List<Integer> ids = new ArrayList<>();
        ids.add(scope.getScopeId());
        
        List<Scope> children = scopeRepository.findByParentScope(scope);
        for (Scope child : children) {
            ids.addAll(getAllSubScopeIds(child));
        }
        return ids;
    }

    /**
     * 자신을 포함한 모든 하위 스코프 목록을 재귀적으로 조회합니다.
     */
    public List<Scope> getAllSubScopes(Scope scope) {
        List<Scope> scopes = new ArrayList<>();
        scopes.add(scope);
        
        List<Scope> children = scopeRepository.findByParentScope(scope);
        for (Scope child : children) {
            scopes.addAll(getAllSubScopes(child));
        }
        return scopes;
    }

    public Scope getLevel2Ancestor(Scope scope) {
        if (scope == null) return null;
        
        // Root (Level 1)
        if (scope.getParentScope() == null) return null;
        
        // Level 2 (Parent is root)
        if (scope.getParentScope().getParentScope() == null) return scope;
        
        // Level 3 (Parent is Level 2)
        if (scope.getParentScope().getParentScope().getParentScope() == null) return scope.getParentScope();
        
        // 그 이상 깊이가 있다면 계속 위로 올라가서 Level 2를 찾음
        Scope current = scope;
        while (current.getParentScope() != null && current.getParentScope().getParentScope() != null) {
            current = current.getParentScope();
        }
        return current;
    }

    @Transactional(readOnly = true)
    public List<ScopeTreeDto> getScopeTree() {
        return scopeRepository.findAll().stream()
                .filter(s -> s.getScopeType() == ScopeType.COMPANY)
                .map(company -> {
                    List<Scope> departments = scopeRepository.findByParentScope(company);
                    List<ScopeDto> allChildren = new ArrayList<>();
                    for (Scope dept : departments) {
                        allChildren.add(ScopeDto.from(dept));
                        scopeRepository.findByParentScope(dept).stream()
                                .map(ScopeDto::from)
                                .forEach(allChildren::add);
                    }
                    return ScopeTreeDto.builder()
                            .id(company.getScopeId())
                            .name(company.getName())
                            .scopeType(company.getScopeType())
                            .children(allChildren)
                            .build();
                })
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Scope> getAccessibleScopes(User user) {
        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        boolean isSuperAdmin = roles.stream().anyMatch(r -> r.getRole().getRoleLevel() >= 100);
        
        if (isSuperAdmin) {
            return scopeRepository.findAll();
        }

        List<Scope> myScopes = userMembershipRepository.findByUser(user).stream()
                .map(UserMembership::getScope)
                .toList();
        
        if (myScopes.isEmpty()) {
            return List.of();
        }

        return myScopes.stream()
                .map(this::getLevel2Ancestor)
                .filter(java.util.Objects::nonNull)
                .flatMap(l2 -> getAllSubScopes(l2).stream())
                .distinct()
                .toList();
    }

    /**
     * 새로운 조직(Scope)을 생성합니다. 최고관리자(roleLevel >= 100)만 가능합니다.
     */
    @Transactional
    public ScopeDto createScope(com.ang.Backend.domain.scope.dto.ScopeCreateRequest request, User requester) {
        if (!isSuperAdmin(requester)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        Scope parent = null;
        if (request.getType() != ScopeType.COMPANY) {
            if (request.getParentId() == null) {
                throw new CustomException(ErrorCode.PARENT_SCOPE_REQUIRED);
            }
            parent = scopeRepository.findById(request.getParentId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }

        String scopeCode = generateUniqueScopeCode();

        Scope scope = Scope.builder()
                .name(request.getName())
                .scopeType(request.getType())
                .parentScope(parent)
                .scopeCode(scopeCode)
                .build();

        Scope savedScope = scopeRepository.save(scope);
        createPhysicalScopeFolder(savedScope.getScopeCode());
        log.info("Scope {} ({}) created by super admin {}", savedScope.getName(), scopeCode, requester.getEmpNo());
        return ScopeDto.from(savedScope);
    }

    /**
     * 조직(Scope)을 논리적으로 삭제(비활성화)합니다. 최고관리자(roleLevel >= 100)만 가능합니다.
     */
    @Transactional
    public void deleteScope(Integer scopeId, User requester) {
        if (!isSuperAdmin(requester)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        Scope scope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        if (scope.getScopeType() == ScopeType.COMPANY) {
            throw new CustomException(ErrorCode.ACCESS_DENIED, "회사(COMPANY) 타입은 비활성화할 수 없습니다.");
        }

        if (!scopeRepository.findByParentScope(scope).isEmpty()) {
            throw new CustomException(ErrorCode.SCOPE_HAS_CHILDREN);
        }

        if (!userMembershipRepository.findByScope(scope).isEmpty()) {
            throw new CustomException(ErrorCode.SCOPE_HAS_MEMBERS);
        }


        scope.setDeletedAt(LocalDateTime.now());
        scopeRepository.save(scope);
        log.info("Scope {} ({}) soft-deleted by super admin {}", scope.getName(), scope.getScopeCode(), requester.getEmpNo());
    }

    private boolean isSuperAdmin(User user) {
        return userRoleRepository.findByUserOrderByRoleLevelDesc(user)
                .stream().anyMatch(r -> r.getRole().getRoleLevel() >= 100);
    }

    private String generateUniqueScopeCode() {
        for (int i = 0; i < 5; i++) {
            String code = "SCOPE_" + UUID.randomUUID().toString()
                    .replace("-", "").substring(0, 8).toUpperCase();
            if (scopeRepository.countByScopeCodeIgnoreDeleted(code) == 0) return code;
        }
        throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR, "고유 부서 코드 생성에 실패했습니다.");
    }

    /**
     * 특정 부서에 새로운 멤버를 추가합니다. (다중 소속 지원)
     */
    @Transactional
    public void addMemberToScope(Integer scopeId, Integer userId, String position, User requester) {
        Scope targetScope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        if (!isManagerOfScope(requester, targetScope)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        }

        if (userMembershipRepository.existsByUserAndScope(targetUser, targetScope)) {
            throw new CustomException(ErrorCode.ALREADY_MEMBER);
        }

        userMembershipRepository.save(UserMembership.builder()
                .user(targetUser)
                .scope(targetScope)
                .position(position != null && !position.trim().isEmpty() ? position : "사원")
                .build());

        Role defaultRole = roleRepository.findByRoleLevel(1)
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));

        userRoleRepository.save(new UserRole(targetUser, targetScope, defaultRole));

        log.info("User {} added to scope {} by manager {}", targetUser.getEmpNo(), targetScope.getScopeCode(), requester.getEmpNo());
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

    public boolean isSameOrParent(Scope potentialParent, Scope target) {
        if (potentialParent.getScopeId().equals(target.getScopeId())) return true;
        Scope current = target.getParentScope();
        while (current != null) {
            if (current.getScopeId().equals(potentialParent.getScopeId())) return true;
            current = current.getParentScope();
        }
        return false;
    }

    private void createPhysicalScopeFolder(String scopeCode) {
        log.debug("Skipping local scope directory creation for {} because files are stored in S3", scopeCode);
    }
}
