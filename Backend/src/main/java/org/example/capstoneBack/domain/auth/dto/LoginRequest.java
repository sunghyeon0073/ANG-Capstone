package org.example.capstoneBack.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class LoginRequest {

    @NotBlank(message = "사번을 입력하세요.")
    private String empNo;

    @NotBlank(message = "비밀번호를 입력하세요.")
    private String password;
}
