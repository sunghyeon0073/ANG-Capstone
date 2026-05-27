package com.ang.Backend.domain.scope.dto;

import com.ang.Backend.common.enums.ScopeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ScopeCreateRequest {

    @NotBlank(message = "부서/팀 이름을 입력해주세요.")
    private String name;

    @NotNull(message = "부서/팀 타입을 선택해주세요.")
    private ScopeType type;

    private Integer parentId;
}
