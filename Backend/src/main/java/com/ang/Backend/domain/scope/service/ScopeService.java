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
     * 새로운 조직(Scope)을 생성합니다.
     */
    @Transactional
    public ScopeDto createScope(com.ang.Backend.domain.scope.dto.ScopeCreateRequest request) {
        Scope parent = null;
        
        if (request.getType() != ScopeType.COMPANY) {
            if (request.getParentId() == null) {
                throw new CustomException(ErrorCode.PARENT_SCOPE_REQUIRED);
            }
            parent = scopeRepository.findById(request.getParentId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }

        if (scopeRepository.existsByScopeCode(request.getScopeCode())) {
            throw new CustomException(ErrorCode.DUPLICATE_SCOPE_CODE);
        }

        Scope scope = Scope.builder()
                .name(request.getName())
                .scopeType(request.getType())
                .parentScope(parent)
                .scopeCode(request.getScopeCode())
                .build();

        Scope savedScope = scopeRepository.save(scope);
        createPhysicalScopeFolder(savedScope.getScopeCode());
        return ScopeDto.from(savedScope);
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
        log.debug("Skipping local scope directory creation for {} because files are stored in S3", scopeCode);
    }
}
