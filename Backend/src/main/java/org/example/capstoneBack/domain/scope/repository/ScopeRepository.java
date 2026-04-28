package org.example.capstoneBack.domain.scope.repository;

import org.example.capstoneBack.common.enums.ScopeType;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScopeRepository extends JpaRepository<Scope, Long> {

    Optional<Scope> findByScopeCode(String scopeCode);

    boolean existsByScopeCode(String scopeCode);

    List<Scope> findByScopeType(ScopeType scopeType);

    List<Scope> findByParentScopeScopeId(Long parentScopeId);
}
