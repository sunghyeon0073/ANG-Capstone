package com.ang.Backend.domain.user.service;

import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.RoleRepository;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.dto.UserUpdateRequest;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .filter(u -> u.getStatus() != UserStatus.ANONYMIZED)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto getUser(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        return toDto(user);
    }

    @Transactional
    public UserDto updateUser(Integer userId, UserUpdateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (req.getName() != null) user.setName(req.getName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        if (req.getBirthdate() != null) user.setBirthdate(req.getBirthdate());
        if (req.getProfileImageUrl() != null) user.setProfileImageUrl(req.getProfileImageUrl());
        return toDto(userRepository.save(user));
    }

    @Transactional
    public void anonymize(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        String anonymizedName = anonymizeName(user.getName());
        user.setName(anonymizedName);
        user.setEmail(null);
        user.setPhone(null);
        user.setBirthdate(null);
        user.setStatus(UserStatus.ANONYMIZED);
        user.setDeletedAt(LocalDateTime.now());
        userRepository.save(user);
    }


    @Transactional
    public void approveUser(Integer userId, Integer roleLevel) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 1. 상태 활성화
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        // 2. 권한 업데이트 (선택 사항)
        if (roleLevel != null) {
            com.ang.Backend.domain.role.entity.Role role = roleRepository.findByRoleLevel(roleLevel)
                    .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
            
            UserMembership membership = userMembershipRepository.findByUser(user).stream()
                    .findFirst().orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

            // 기존 권한 삭제 후 새로운 권한 부여 (단순화된 정책)
            userRoleRepository.deleteByUserAndScope(user, membership.getScope());
            userRoleRepository.save(new UserRole(user, membership.getScope(), role));
        }
    }

    public List<UserDto> getPendingUsersByScopes(List<Integer> scopeIds) {
        return userMembershipRepository.findByScopeScopeIdIn(scopeIds).stream()
                .map(UserMembership::getUser)
                .filter(u -> u.getStatus() == UserStatus.PENDING)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<UserDto> getPendingUsers() {
        return userRepository.findByStatus(UserStatus.PENDING).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }


    private UserDto toDto(User user) {
        String dept = userMembershipRepository.findByUser(user).stream()
                .map(m -> m.getScope().getName())
                .collect(Collectors.joining(", "));
        
        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        int maxLevel = roles.stream().mapToInt(ur -> ur.getRole().getRoleLevel()).max().orElse(0);
        String roleLabel = maxLevel >= 100 ? "최고관리자" : maxLevel >= 50 ? "관리자" : "일반";

        String avatar = user.getName() != null && user.getName().length() >= 2
                ? user.getName().substring(0, 2).toUpperCase()
                : (user.getName() != null ? user.getName().toUpperCase() : "");

        return UserDto.builder()
                .id(user.getUserId())
                .empNo(user.getEmpNo())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .birthdate(user.getBirthdate())
                .profileImageUrl(user.getProfileImageUrl())
                .position(user.getPosition())
                .status(user.getStatus())
                .dept(dept)
                .role(roleLabel)
                .roleLevel(maxLevel)
                .avatar(avatar)
                .build();
    }

    private String anonymizeName(String name) {
        if (name == null || name.isEmpty()) return "@";
        String surname = name.substring(0, 1);
        String rest = "@".repeat(name.length() - 1);
        return surname + rest;
    }
}
