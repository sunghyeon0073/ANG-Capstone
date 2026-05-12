package com.ang.Backend.domain.auth.dto;

import com.ang.Backend.domain.user.dto.UserDto;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private UserDto user;
}
