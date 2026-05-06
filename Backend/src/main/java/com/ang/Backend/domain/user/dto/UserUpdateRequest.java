package com.ang.Backend.domain.user.dto;

import lombok.Getter;

import java.time.LocalDate;

@Getter
public class UserUpdateRequest {
    private String name;
    private String email;
    private String phone;
    private LocalDate birthdate;
    private String profileImageUrl;
}
