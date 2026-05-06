package com.ang.Backend.domain.user.DTO;

import lombok.Getter;

@Getter
public class LoginRequest {
    private String empNo;
    private String password;
}
