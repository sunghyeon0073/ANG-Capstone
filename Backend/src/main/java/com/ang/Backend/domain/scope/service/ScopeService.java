package com.ang.Backend.domain.scope.service;

import com.ang.Backend.common.enums.ScopeType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.scope.dto.ScopeDto;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScopeService {

    private final ScopeRepository scopeRepository;

    /**
     * 자신을 포함한 모든 하위 스코프 ID 목록을 재귀적으로 조회합니다.
     */
    public List<Integer> getAllSubScopeIds(Scope scope) {
        List<Integer> ids = new ArrayList<>();
        ids.add(scope.getScopeId());
        
        List<Scope> children = scopeRepository.findByParentScope(scope);
        for (Scope child : children) {
            ids.addAll(getAllSubScopeIds(child));
        }
        return ids;
    }

    /**
     * 새로운 조직(Scope)을 생성합니다.
     */
    @Transactional
    public ScopeDto createScope(com.ang.Backend.domain.scope.dto.ScopeCreateRequest request) {
        Scope parent = null;
        
        // 1. COMPANY(최상위)가 아닌 하위 부서/팀 생성 시 부모 부서 강제
        if (request.getType() != ScopeType.COMPANY) {
            if (request.getParentId() == null) {
                throw new CustomException(ErrorCode.PARENT_SCOPE_REQUIRED);
            }
            parent = scopeRepository.findById(request.getParentId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }

        // 2. 관리자가 직접 입력한 팀 코드 중복 검사
        if (scopeRepository.existsByScopeCode(request.getScopeCode())) {
            throw new CustomException(ErrorCode.DUPLICATE_SCOPE_CODE);
        }

        Scope scope = Scope.builder()
                .name(request.getName())
                .scopeType(request.getType())
                .parentScope(parent)
                .scopeCode(request.getScopeCode())
                .build();

        return ScopeDto.from(scopeRepository.save(scope));
    }
}
