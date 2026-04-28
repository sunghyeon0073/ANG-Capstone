package org.example.capstoneBack.domain.user.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.auth.dto.PasswordChangeRequest;
import org.example.capstoneBack.domain.role.entity.Role;
import org.example.capstoneBack.domain.role.repository.RoleRepository;
import org.example.capstoneBack.domain.user.dto.UserDto;
import org.example.capstoneBack.domain.user.dto.UserUpdateRequest;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.entity.UserRole;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.example.capstoneBack.domain.user.repository.UserRoleRepository;
import org.example.capstoneBack.domain.notification.entity.Notification;
import org.example.capstoneBack.domain.notification.repository.NotificationRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.repository.UserMembershipRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("^(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{6,24}$");

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final RoleRepository roleRepository;
    private final ScopeRepository scopeRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public UserDto getMyInfo(String empNo) {
        User user = findByEmpNo(empNo);
        return UserDto.from(user);
    }

    @Transactional
    public UserDto updateMyInfo(String empNo, UserUpdateRequest request) {
        User user = findByEmpNo(empNo);
        user.updateProfile(request.getName(), request.getEmail(), request.getPhone(),
                request.getBirthdate(), request.getProfileImageUrl());
        return UserDto.from(user);
    }

    @Transactional
    public void changePassword(String empNo, PasswordChangeRequest request) {
        if (!request.getNewPassword().equals(request.getNewPasswordConfirm())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "새 비밀번호가 일치하지 않습니다.");
        }
        if (!PASSWORD_PATTERN.matcher(request.getNewPassword()).matches()) {
            throw new CustomException(ErrorCode.PASSWORD_POLICY_VIOLATION);
        }
        User user = findByEmpNo(empNo);
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD);
        }
        user.updatePassword(passwordEncoder.encode(request.getNewPassword()));
    }

    // 관리자 전용
    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream().map(UserDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<UserDto> getPendingUsers() {
        return userRepository.findByStatus(org.example.capstoneBack.common.enums.UserStatus.PENDING)
                .stream().map(UserDto::from).toList();
    }

    @Transactional
    public void approveUser(Long userId) {
        User user = findById(userId);
        user.approve();

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));

        userMembershipRepository.findByUserUserId(userId).forEach(membership -> {
            Scope scope = membership.getScope();
            boolean alreadyHasRole = !userRoleRepository
                    .findByUserUserIdAndScopeScopeId(userId, scope.getScopeId()).isEmpty();
            if (!alreadyHasRole) {
                userRoleRepository.save(UserRole.builder()
                        .user(user).scope(scope).role(userRole).build());
            }
        });

        sendNotification(user, "SYSTEM", "계정이 승인되었습니다. 로그인하여 서비스를 이용하세요.", null);
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = findById(userId);
        user.anonymize();
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long userId) {
        return UserDto.from(findById(userId));
    }

    // 사번 수정 (관리자만 가능, Teamjang-01)
    @Transactional
    public void updateEmpNo(Long userId, String newEmpNo) {
        if (userRepository.existsByEmpNo(newEmpNo)) {
            throw new CustomException(ErrorCode.DUPLICATE_EMP_NO);
        }
        User user = findById(userId);
        user.updateEmpNo(newEmpNo);
    }

    // 역할 변경 (관리자만 가능, Teamjang-01)
    @Transactional
    public void changeUserRole(Long userId, Long scopeId, String roleName) {
        User user = findById(userId);
        Scope scope = scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        Role newRole = roleRepository.findByName(roleName)
                .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));

        userRoleRepository.deleteByUserUserIdAndScopeScopeId(userId, scopeId);
        userRoleRepository.save(UserRole.builder()
                .user(user).scope(scope).role(newRole).build());
    }

    private User findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private User findByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private void sendNotification(User user, String type, String message, String url) {
        notificationRepository.save(Notification.builder()
                .user(user).notifType(type).message(message).targetUrl(url).build());
    }
}
