package com.ang.Backend.domain.user.DTO;

import lombok.Getter;

@Getter
public class RoleUpdateRequest {
    private Integer roleLevel;
    private String rank;
}
