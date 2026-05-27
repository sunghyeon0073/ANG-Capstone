package com.ang.Backend.domain.scope.repository;

import com.ang.Backend.domain.scope.entity.Scope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ScopeRepository extends JpaRepository<Scope, Integer> {
    Optional<Scope> findByScopeCode(String scopeCode);
    boolean existsByScopeCode(String scopeCode);
    List<Scope> findByParentScope(Scope parentScope);

    // @SQLRestriction을 무시하고 soft-delete된 코드도 포함해 중복 여부를 확인 (native query는 Integer 반환)
    @Query(value = "SELECT COUNT(*) FROM scopes WHERE scope_code = :code", nativeQuery = true)
    int countByScopeCodeIgnoreDeleted(@Param("code") String code);
}
