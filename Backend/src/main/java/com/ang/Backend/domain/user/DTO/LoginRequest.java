package com.ang.Backend.domain.user.DTO;

import lombok.Getter;

@Getter
public class LoginRequest {
    private String email;
    private String password;
}
