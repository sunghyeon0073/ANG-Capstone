package com.ang.Backend.domain.document.repository;

import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.file.entity.FileItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {

    List<DocumentEntity> findByOwnerAndDeletedAtIsNull(User owner);
    List<DocumentEntity> findByOwnerAndDeletedAtIsNotNull(User owner);
    
    List<DocumentEntity> findAllByDeletedAtIsNull();

    @Query("SELECT d FROM DocumentEntity d WHERE d.scope.scopeId IN :scopeIds " +
            "AND d.deletedAt IS NULL " +
            "AND (:keyword IS NULL OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    List<DocumentEntity> searchByScopesAndDeletedAtIsNull(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword);

    @Query("SELECT d FROM DocumentEntity d WHERE d.scope.scopeId IN :scopeIds " +
            "AND d.deletedAt IS NOT NULL " +
            "AND (:keyword IS NULL OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    List<DocumentEntity> searchByScopesAndDeletedAtIsNotNull(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword);

    // 30일 이상 지난 삭제된 문서 조회용
    @Query("SELECT d FROM DocumentEntity d WHERE d.deletedAt <= :cutoffDate")
    List<DocumentEntity> findByDeletedAtBefore(@Param("cutoffDate") java.time.LocalDateTime cutoffDate);

    boolean existsByFile(FileItem file);
    void deleteByFile(FileItem file);
    }