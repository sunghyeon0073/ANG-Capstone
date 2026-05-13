package com.ang.Backend.domain.scope.dto;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.domain.scope.entity.Scope;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Builder
public class ScopeDto {
    private Integer id;
    private String scopeCode;
    private String name;
    private ScopeType scopeType;
    private String type;
    private Integer parentId;

    @Setter
    @Builder.Default
    private List<ScopeDto> children = new ArrayList<>();

    public static ScopeDto from(Scope scope) {
        return ScopeDto.builder()
                .id(scope.getScopeId())
                .scopeCode(scope.getScopeCode())
                .name(scope.getName())
                .scopeType(scope.getScopeType())
                .type(scope.getScopeType() != null ? scope.getScopeType().name() : null)
                .parentId(scope.getParentScope() != null ? scope.getParentScope().getScopeId() : null)
                .build();
    }
}
