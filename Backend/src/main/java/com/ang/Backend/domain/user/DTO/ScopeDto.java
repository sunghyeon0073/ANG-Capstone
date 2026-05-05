package com.ang.Backend.domain.user.DTO;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.domain.user.entity.Scope;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ScopeDto {
    private Integer id;
    private String scopeCode;
    private String name;
    private ScopeType scopeType;
    private Integer parentId;

    public static ScopeDto from(Scope scope) {
        return ScopeDto.builder()
                .id(scope.getScopeId())
                .scopeCode(scope.getScopeCode())
                .name(scope.getName())
                .scopeType(scope.getScopeType())
                .parentId(scope.getParentScope() != null ? scope.getParentScope().getScopeId() : null)
                .build();
    }
}
