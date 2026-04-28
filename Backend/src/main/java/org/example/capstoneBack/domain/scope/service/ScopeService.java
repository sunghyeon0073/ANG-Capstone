package org.example.capstoneBack.domain.scope.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.scope.dto.ScopeCreateRequest;
import org.example.capstoneBack.domain.scope.dto.ScopeDto;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScopeService {

    private final ScopeRepository scopeRepository;

    @Transactional(readOnly = true)
    public List<ScopeDto> getAllScopes() {
        return scopeRepository.findAll().stream().map(ScopeDto::from).toList();
    }

    @Transactional(readOnly = true)
    public ScopeDto getScopeById(Long scopeId) {
        return ScopeDto.from(findById(scopeId));
    }

    @Transactional
    public ScopeDto createScope(ScopeCreateRequest request) {
        if (scopeRepository.existsByScopeCode(request.getScopeCode())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "이미 사용 중인 부서 코드입니다.");
        }

        Scope parentScope = null;
        if (request.getParentScopeId() != null) {
            parentScope = findById(request.getParentScopeId());
        }

        Scope scope = Scope.builder()
                .scopeType(request.getScopeType())
                .parentScope(parentScope)
                .scopeCode(request.getScopeCode())
                .name(request.getName())
                .build();

        return ScopeDto.from(scopeRepository.save(scope));
    }

    @Transactional
    public ScopeDto updateScope(Long scopeId, String name) {
        Scope scope = findById(scopeId);
        scope.update(name);
        return ScopeDto.from(scope);
    }

    @Transactional
    public void deleteScope(Long scopeId) {
        scopeRepository.deleteById(scopeId);
    }

    @Transactional(readOnly = true)
    public List<ScopeDto> getChildScopes(Long parentScopeId) {
        return scopeRepository.findByParentScopeScopeId(parentScopeId)
                .stream().map(ScopeDto::from).toList();
    }

    private Scope findById(Long scopeId) {
        return scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
