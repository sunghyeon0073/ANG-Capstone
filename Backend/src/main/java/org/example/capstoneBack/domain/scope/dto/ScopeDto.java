package org.example.capstoneBack.domain.scope.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.ScopeType;
import org.example.capstoneBack.domain.scope.entity.Scope;

@Getter
@Builder
@AllArgsConstructor
public class ScopeDto {

    private Long scopeId;
    private ScopeType scopeType;
    private Long parentScopeId;
    private String scopeCode;
    private String name;

    public static ScopeDto from(Scope scope) {
        return ScopeDto.builder()
                .scopeId(scope.getScopeId())
                .scopeType(scope.getScopeType())
                .parentScopeId(scope.getParentScope() != null ? scope.getParentScope().getScopeId() : null)
                .scopeCode(scope.getScopeCode())
                .name(scope.getName())
                .build();
    }
}
