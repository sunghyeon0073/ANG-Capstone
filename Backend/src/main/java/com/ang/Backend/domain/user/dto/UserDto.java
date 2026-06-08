package com.ang.Backend.domain.user.dto;

import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Builder
public class UserDto {
    private Integer id;
    private String empNo;
    private String name;
    private String email;
    private String phone;
    private LocalDate birthdate;
    private String profileImageUrl;
    private String signatureImageUrl;
    private String position; // Primary or legacy position
    private UserStatus status;
    private String dept;     // Legacy or summary dept
    private String role;
    private int roleLevel;
    private String avatar;
    private String rejectionReason;

    private List<DepartmentInfo> departments;

    @Getter
    @Builder
    public static class DepartmentInfo {
        private Integer scopeId;
        private String scopeName;
        private String scopeCode;
        private String position;
    }

    // 메일 수신자 검색 결과 (이름/사번 검색 후 선택용)
    @Getter
    @Builder
    public static class RecipientSearchResult {
        private String empNo;
        private String name;
        private String position;
        private List<DepartmentInfo> departments;  // 소속 부서 + 직책

        public static RecipientSearchResult from(User user, List<UserMembership> memberships) {
            List<DepartmentInfo> depts = memberships.stream()
                    .map(m -> DepartmentInfo.builder()
                            .scopeId(m.getScope().getScopeId())
                            .scopeName(m.getScope().getName())
                            .scopeCode(m.getScope().getScopeCode())
                            .position(m.getPosition())
                            .build())
                    .collect(Collectors.toList());

            String position = memberships.stream()
                    .map(UserMembership::getPosition)
                    .filter(p -> p != null && !p.isBlank())
                    .findFirst()
                    .orElse(user.getPosition());

            return RecipientSearchResult.builder()
                    .empNo(user.getEmpNo())
                    .name(user.getName())
                    .position(position)
                    .departments(depts)
                    .build();
        }
    }

    public static UserDto from(User user) {
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
                .signatureImageUrl(user.getSignatureImageUrl())
                .position(user.getPosition())
                .status(user.getStatus())
                .avatar(avatar)
                .build();
    }
}
