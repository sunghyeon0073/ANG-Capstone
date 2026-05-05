package com.ang.Backend.domain.user.repository;

import com.ang.Backend.domain.user.entity.Scope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScopeRepository extends JpaRepository<Scope, Integer> {
    Optional<Scope> findByScopeCode(String scopeCode);
    boolean existsByScopeCode(String scopeCode);
}
