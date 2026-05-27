package com.ang.Backend.domain.scope.dto;

import com.ang.Backend.common.enums.ScopeType;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ScopeTreeDto {
    private Integer id;
    private String name;
    private ScopeType scopeType;
    private List<ScopeDto> children;
}
