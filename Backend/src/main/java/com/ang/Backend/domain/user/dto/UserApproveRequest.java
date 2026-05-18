package com.ang.Backend.domain.user.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class UserApproveRequest {
    private String position;
    private Integer roleLevel;
}
