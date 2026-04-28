package org.example.capstoneBack.domain.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
public class SignUpRequest {

    @NotBlank(message = "이름을 입력하세요.")
    private String name;

    @NotBlank(message = "사번을 입력하세요.")
    private String empNo;

    @NotNull(message = "생년월일을 입력하세요.")
    private LocalDate birthdate;

    @NotBlank(message = "이메일을 입력하세요.")
    @Email(message = "올바른 이메일 형식을 입력하세요.")
    private String email;

    @NotBlank(message = "비밀번호를 입력하세요.")
    @Size(min = 6, max = 24, message = "비밀번호는 6자 이상 25자 미만으로 입력하세요.")
    @Pattern(regexp = "^(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).+$",
            message = "비밀번호는 영문과 특수문자를 포함해야 합니다.")
    private String password;

    @NotBlank(message = "비밀번호 확인을 입력하세요.")
    private String passwordConfirm;

    @NotBlank(message = "부서 고유 코드를 입력하세요.")
    private String scopeCode;
}
