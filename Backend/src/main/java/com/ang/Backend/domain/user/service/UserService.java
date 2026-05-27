package com.ang.Backend.domain.user.service;

import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.service.S3FileService;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final S3FileService s3FileService;

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto getUser(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        return toDto(user);
    }

    public record ProfileImageResult(byte[] bytes, String contentType) {}

    @Transactional(readOnly = true)
    public ProfileImageResult getProfileImage(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (user.getProfileImageUrl() == null) {
            throw new CustomException(ErrorCode.FILE_NOT_FOUND);
        }
        String key = user.getProfileImageUrl();
        byte[] bytes = s3FileService.download(key);
        String contentType = resolveContentType(key);
        return new ProfileImageResult(bytes, contentType);
    }

    private String resolveContentType(String key) {
        String lower = key.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    @Transactional
    public UserDto uploadProfileImage(Integer userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (user.getProfileImageUrl() != null) {
            s3FileService.delete(user.getProfileImageUrl());
        }
        String key = s3FileService.upload(file, "profiles");
        user.setProfileImageUrl(key);
        return toDto(userRepository.save(user));
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

    /**
     * 퇴사(익명화) 처리: 
     * 히스토리는 유지하되 개인정보를 삭제함.
     * 사번(empNo)을 그대로 유지하여 동일 사번으로의 재가입을 차단함.
     */
    @Transactional
    public void anonymize(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        String originalEmpNo = user.getEmpNo();
        String anonymizedName = anonymizeName(user.getName());
        
        user.setName(anonymizedName);
        user.setEmail(null);
        user.setPhone(null);
        user.setBirthdate(null);
        user.setStatus(UserStatus.ANONYMIZED);
        user.setDeletedAt(LocalDateTime.now());
        
        userRepository.save(user);

        log.info("User {} ({}) anonymized for retirement. Re-registration with this ID is blocked.", originalEmpNo, user.getUserId());
    }

    /**
     * 가입 거절 처리:
     * 거절된 사용자는 시스템 데이터가 없으므로 DB에서 완전히 삭제함.
     * 이를 통해 동일한 사번으로 다시 가입 신청을 할 수 있도록 함.
     */
    @Transactional
    public void rejectUser(Integer userId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 1. 소속 정보 및 권한 삭제
        userRoleRepository.deleteByUser(user);
        userMembershipRepository.deleteByUser(user);
        
        // 2. 사용자 본인 레코드 삭제
        userRepository.delete(user);
        
        log.info("User {} signup rejected and record deleted to allow re-registration. Reason: {}", user.getEmpNo(), reason);
    }

    @Transactional
    public void approveUser(Integer userId, Integer roleLevel, String position) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 1. 상태 활성화
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        // 2. 권한 및 직급 업데이트
        UserMembership membership = userMembershipRepository.findByUser(user).stream()
                .findFirst().orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        if (position != null && !position.isEmpty()) {
            membership.setPosition(position);
            userMembershipRepository.save(membership);
        }

        if (roleLevel != null) {
            com.ang.Backend.domain.role.entity.Role role = roleRepository.findByRoleLevel(roleLevel)
                    .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
            
            userRoleRepository.deleteByUserAndScope(user, membership.getScope());
            userRoleRepository.save(new UserRole(user, membership.getScope(), role));
        }
    }

    @Transactional(readOnly = true)
    public List<UserDto> getPendingUsersByScopes(List<Integer> scopeIds) {
        return userMembershipRepository.findByScopeScopeIdIn(scopeIds).stream()
                .map(UserMembership::getUser)
                .filter(u -> u.getStatus() == UserStatus.PENDING)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto> getPendingUsers() {
        return userRepository.findByStatus(UserStatus.PENDING).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto.RecipientSearchResult> searchUsers(String keyword) {
        return userRepository.searchByKeyword(keyword, UserStatus.ACTIVE).stream()
                .map(user -> UserDto.RecipientSearchResult.from(
                        user, userMembershipRepository.findByUser(user)))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto toDto(User user) {
        List<UserMembership> memberships = userMembershipRepository.findByUser(user);

        String dept = memberships.stream()
                .map(UserMembership::getScope)
                .filter(s -> s.getScopeType() != com.ang.Backend.common.enums.ScopeType.COMPANY)
                .map(com.ang.Backend.domain.scope.entity.Scope::getName)
                .collect(Collectors.joining(", "));
        
        if (dept.isEmpty()) {
            dept = memberships.stream()
                    .map(m -> m.getScope().getName())
                    .collect(Collectors.joining(", "));
        }

        String computedPosition = memberships.stream()
            .map(UserMembership::getPosition)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        if (computedPosition.isEmpty()) {
            computedPosition = user.getPosition();
        }

        List<UserDto.DepartmentInfo> departmentInfos = memberships.stream()
                .map(m -> UserDto.DepartmentInfo.builder()
                        .scopeId(m.getScope().getScopeId())
                        .scopeName(m.getScope().getName())
                        .scopeCode(m.getScope().getScopeCode())
                        .position(m.getPosition())
                        .build())
                .collect(Collectors.toList());

        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        int maxLevel = roles.stream().mapToInt(ur -> ur.getRole().getRoleLevel()).max().orElse(0);
        String roleLabel = maxLevel >= 100 ? "최고관리자" : maxLevel >= 50 ? "관리자" : "일반 사용자";

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
                .position(computedPosition)
                .status(user.getStatus())
                .dept(dept)
                .role(roleLabel)
                .roleLevel(maxLevel)
                .avatar(avatar)
                .rejectionReason(user.getRejectionReason())
                .departments(departmentInfos)
                .build();
    }

    private String anonymizeName(String name) {
        if (name == null || name.isEmpty()) return "@";
        String surname = name.substring(0, 1);
        String rest = "@".repeat(name.length() - 1);
        return surname + rest;
    }
}
