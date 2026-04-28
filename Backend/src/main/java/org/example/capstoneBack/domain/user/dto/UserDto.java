package org.example.capstoneBack.domain.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.UserStatus;
import org.example.capstoneBack.domain.user.entity.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class UserDto {

    private Long userId;
    private String empNo;
    private String name;
    private String email;
    private String phone;
    private LocalDate birthdate;
    private String profileImageUrl;
    private UserStatus status;
    private LocalDateTime createdAt;

    public static UserDto from(User user) {
        return UserDto.builder()
                .userId(user.getUserId())
                .empNo(user.getEmpNo())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .birthdate(user.getBirthdate())
                .profileImageUrl(user.getProfileImageUrl())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
