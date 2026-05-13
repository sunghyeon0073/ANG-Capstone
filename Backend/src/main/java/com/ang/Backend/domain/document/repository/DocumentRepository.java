package com.ang.Backend.domain.document.repository;

import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {

    List<DocumentEntity> findByOwner(User owner);

    @Query("SELECT d FROM DocumentEntity d WHERE d.scope.scopeId IN :scopeIds " +
            "AND (:keyword IS NULL OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    List<DocumentEntity> searchByScopes(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword);
}