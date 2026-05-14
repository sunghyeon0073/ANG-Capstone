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
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 사용자 정보와 관련된 비즈니스 로직을 처리하는 서비스 클래스
 * 사용자 조회, 수정, 승인, 거절, 탈퇴(익명화) 등의 기능을 포함합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;

    /**
     * 활성 상태인 모든 사용자 목록을 조회합니다.
     * 익명화(탈퇴)된 사용자는 목록에서 제외됩니다.
     */
    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .filter(u -> u.getStatus() != UserStatus.ANONYMIZED)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * 특정 사용자의 상세 정보를 조회합니다.
     */
    @Transactional(readOnly = true)
    public UserDto getUser(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        return toDto(user);
    }

    /**
     * 사용자의 프로필 정보(이름, 이메일, 연락처 등)를 업데이트합니다.
     */
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
     * 사용자 탈퇴 처리를 위한 익명화 로직
     * DB에서 데이터를 직접 삭제하지 않고, 개인정보를 마스킹 처리하여 데이터 무결성을 유지합니다.
     */
    @Transactional
    public void anonymize(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 1. 이름 마스킹 (예: 홍길동 -> 홍@@)
        String anonymizedName = anonymizeName(user.getName());
        user.setName(anonymizedName);
        
        // 2. 주요 개인정보 삭제
        user.setEmail(null);
        user.setPhone(null);
        user.setBirthdate(null);
        
        // 3. 상태 변경 및 삭제 시간 기록
        user.setStatus(UserStatus.ANONYMIZED);
        user.setDeletedAt(LocalDateTime.now());
        
        userRepository.save(user);
    }


    /**
     * 가입 대기 중인 사용자를 관리자가 승인하는 로직
     * 사용자 상태를 ACTIVE로 변경하고, 요청된 직급과 권한 레벨을 부여합니다.
     */
    @Transactional
    public void approveUser(Integer userId, Integer roleLevel, String position) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 1. 계정 활성화
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        // 2. 부서 소속 정보(Membership) 업데이트
        // 가입 시 선택했던 부서를 찾아 직급(Position)을 최종 확정합니다.
        UserMembership membership = userMembershipRepository.findByUser(user).stream()
                .findFirst().orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));

        if (position != null && !position.isEmpty()) {
            membership.setPosition(position);
            userMembershipRepository.save(membership);
        }

        // 3. 권한(Role) 부여
        // 선택된 권한 레벨에 맞는 Role 엔티티를 찾아 해당 부서 내에서의 역할을 저장합니다.
        if (roleLevel != null) {
            com.ang.Backend.domain.role.entity.Role role = roleRepository.findByRoleLevel(roleLevel)
                    .orElseThrow(() -> new CustomException(ErrorCode.ROLE_NOT_FOUND));
            
            // 기존에 임시로 부여된 권한(Level 0)을 삭제하고 새로운 권한 부여
            userRoleRepository.deleteByUserAndScope(user, membership.getScope());
            userRoleRepository.save(new UserRole(user, membership.getScope(), role));
        }
    }

    /**
     * [가입 거절 로직]
     * 관리자가 부적절한 가입 요청을 반려할 때 실행됩니다.
     * 
     * @Transactional: 이 어노테이션은 DB의 원자성을 보장합니다. 
     * 상태 변경과 사유 저장이 하나의 작업으로 묶여, 중간에 에러가 나면 모든 변경사항을 취소(Rollback)합니다.
     * 
     * [데이터 흐름]
     * 1. AdminController로부터 대상 유저 ID(userId)와 거절 사유(reason)를 전달받음
     * 2. DB에서 해당 유저의 Entity를 조회하여 메모리에 로드
     * 3. 유저의 status 필드와 rejectionReason 필드를 업데이트
     * 4. 메소드 종료 시 JPA가 변경을 감지하여 DB에 UPDATE SQL을 실행
     */
    @Transactional
    public void rejectUser(Integer userId, String reason) {
        // 1. 유저 존재 여부 확인 (잘못된 ID 요청 시 예외 발생)
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        
        // 2. 유저 상태를 '거절(REJECTED)'로 변경
        // 이 상태가 되면 AuthService의 로그인 로직에서 진입이 차단됩니다.
        user.setStatus(UserStatus.REJECTED);

        // 3. 관리자가 입력한 거절 사유를 DB에 저장
        // 저장된 사유는 나중에 유저가 로그인을 시도할 때 에러 메시지로 반환됩니다.
        user.setRejectionReason(reason);

        // 4. JPA의 dirty checking(변경 감지)에 의해 수정사항이 DB에 반영됨
        userRepository.save(user);
        
        // 5. 서버 로그에 기록 (보안 및 감사용)
        log.info("가입 거절 처리 완료 - 사번: {}, 사유: {}", user.getEmpNo(), reason);
    }

    /**
     * 특정 부서(Scope)들에 속한 가입 대기자 목록을 조회합니다. (관할 부서 필터링용)
     */
    @Transactional(readOnly = true)
    public List<UserDto> getPendingUsersByScopes(List<Integer> scopeIds) {
        return userMembershipRepository.findByScopeScopeIdIn(scopeIds).stream()
                .map(UserMembership::getUser)
                .filter(u -> u.getStatus() == UserStatus.PENDING)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * 시스템 전체의 가입 대기자 목록을 조회합니다. (최고관리자용)
     */
    @Transactional(readOnly = true)
    public List<UserDto> getPendingUsers() {
        return userRepository.findByStatus(UserStatus.PENDING).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

/**
 * User 엔티티를 화면 전달용 DTO로 변환합니다.
 * 이 과정에서 사용자의 모든 소속 부서 정보와 가장 높은 권한 레벨을 계산합니다.
 */
@Transactional(readOnly = true)
public UserDto toDto(User user) {
    // 사용자가 속한 모든 부서 조회
    List<UserMembership> memberships = userMembershipRepository.findByUser(user);

    // 부서명들을 콤마로 연결 (문자열 요약용)
    String dept = memberships.stream()
            .map(m -> m.getScope().getName())
            .collect(Collectors.joining(", "));

    // 부서별 직급들 중 고유한 값들을 추출
    String computedPosition = memberships.stream()
            .map(UserMembership::getPosition)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
    if (computedPosition.isEmpty()) {
        computedPosition = user.getPosition(); // 기존 정보가 없으면 기본 직급 사용
    }

    // 상세 부서 정보 목록 생성
    List<UserDto.DepartmentInfo> departmentInfos = memberships.stream()
            .map(m -> UserDto.DepartmentInfo.builder()
                    .scopeId(m.getScope().getScopeId())
                    .scopeName(m.getScope().getName())
                    .scopeCode(m.getScope().getScopeCode())
                    .position(m.getPosition())
                    .build())
            .collect(Collectors.toList());

    // 사용자의 모든 권한 중 가장 높은 레벨을 찾아 역할 레이블 결정
    List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
    int maxLevel = roles.stream().mapToInt(ur -> ur.getRole().getRoleLevel()).max().orElse(0);
    String roleLabel = maxLevel >= 100 ? "최고관리자" : maxLevel >= 50 ? "관리자" : "일반 사용자";

    // 아바타용 텍스트 생성 (이름 앞 두 글자)
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
