package org.example.capstoneBack.domain.document.repository;

import org.example.capstoneBack.domain.document.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByOwnerUserId(Long ownerId);

    List<Document> findByScopeScopeId(Long scopeId);

    @Query("SELECT d FROM Document d WHERE d.owner.userId = :ownerId AND (d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    List<Document> searchByKeyword(@Param("ownerId") Long ownerId,
                                   @Param("keyword") String keyword);

    List<Document> findByIsAiGeneratedTrue();
}
