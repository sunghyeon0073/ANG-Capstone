package com.ang.Backend.domain.scope.dto;

import com.ang.Backend.common.enums.ScopeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ScopeCreateRequest {

    @NotBlank(message = "부서/팀 이름을 입력해주세요.")
    private String name;

    @NotNull(message = "부서/팀 타입을 선택해주세요.")
    private ScopeType type;

    @NotBlank(message = "고유 식별 코드(팀 코드)를 직접 입력해주세요.")
    private String scopeCode;

    // COMPANY 타입이 아니라면 부모 부서가 반드시 필요합니다. 이는 Service 단에서 검증합니다.
    private Integer parentId;
}
