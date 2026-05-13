package com.ang.Backend.domain.user.dto;

import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

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
    private String position;
    private UserStatus status;
    private String dept;
    private String role;
    private int roleLevel;
    private String avatar;

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
                .position(user.getPosition())
                .status(user.getStatus())
                .avatar(avatar)
                .build();
    }
}
