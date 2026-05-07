package com.ang.Backend.domain.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;

import java.time.LocalDate;

@Getter
public class RegisterRequest {

    @NotBlank(message = "이름을 입력해주세요.")
    @Size(max = 50)
    private String name;

    @NotBlank(message = "사번을 입력해주세요.")
    @Size(max = 50)
    private String empNo;

    @NotNull(message = "생년월일을 입력해주세요.")
    @Past(message = "올바른 생년월일을 입력해주세요.")
    private LocalDate birthdate;

    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "올바른 이메일 형식을 입력해주세요.")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    private String password;

    @NotBlank(message = "비밀번호 확인을 입력해주세요.")
    private String passwordConfirm;

    @NotBlank(message = "부서 코드를 입력해주세요.")
    private String scopeCode;
}
