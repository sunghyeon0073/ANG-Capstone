package com.ang.Backend.domain.user.DTO;

import com.ang.Backend.domain.user.entity.Member;
import lombok.Getter;

@Getter
public class MemberResponse {

    private final Long id;
    private final String empNo;
    private final String name;
    private final String email;
    private final String role;

    public MemberResponse(Member member) {
        this.id = member.getId();
        this.empNo = member.getEmpNo();
        this.name = member.getName();
        this.email = member.getEmail();
        this.role = member.getRole();
    }
}
