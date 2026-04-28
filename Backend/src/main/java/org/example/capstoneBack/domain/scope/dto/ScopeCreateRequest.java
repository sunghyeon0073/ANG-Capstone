package org.example.capstoneBack.domain.scope.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.example.capstoneBack.common.enums.ScopeType;

@Getter
@NoArgsConstructor
public class ScopeCreateRequest {

    @NotNull(message = "부서 유형을 입력하세요.")
    private ScopeType scopeType;

    private Long parentScopeId;

    @NotBlank(message = "부서 고유 코드를 입력하세요.")
    private String scopeCode;

    @NotBlank(message = "부서명을 입력하세요.")
    private String name;
}
