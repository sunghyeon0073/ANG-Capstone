package com.ang.Backend.domain.user.DTO;

import com.ang.Backend.domain.user.entity.Member;
import lombok.Getter;

@Getter
public class LoginResponse {
    private final Long id;
    private final String name;
    private final String email;
    private final String role;

    public LoginResponse(Member member) {
        this.id = member.getId();
        this.name = member.getName();
        this.email = member.getEmail();
        this.role = member.getRole();
    }
}
