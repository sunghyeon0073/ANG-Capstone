package com.ang.Backend.domain.scope.repository;

import com.ang.Backend.domain.scope.entity.Scope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScopeRepository extends JpaRepository<Scope, Integer> {
    Optional<Scope> findByScopeCode(String scopeCode);
    boolean existsByScopeCode(String scopeCode);
    List<Scope> findByParentScope(Scope parentScope);
}
