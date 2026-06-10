package com.ang.Backend.domain.document.repository;

import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.file.entity.FileItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {

    Page<DocumentEntity> findByOwnerAndDeletedAtIsNull(User owner, Pageable pageable);

    List<DocumentEntity> findByOwnerAndDeletedAtIsNull(User owner);

    @Query("SELECT d FROM DocumentEntity d WHERE d.owner = :owner AND d.deletedAt IS NULL AND d.scope IS NULL " +
            "AND (:keyword IS NULL OR :keyword = '' OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    Page<DocumentEntity> findMyDocuments(@Param("owner") User owner, @Param("keyword") String keyword, Pageable pageable);

    Page<DocumentEntity> findByOwnerAndDeletedAtIsNotNull(User owner, Pageable pageable);

    Page<DocumentEntity> findAllByDeletedAtIsNull(Pageable pageable);

    List<DocumentEntity> findAllByDeletedAtIsNull();

    @Query("SELECT d FROM DocumentEntity d WHERE d.scope.scopeId IN :scopeIds " +
            "AND d.deletedAt IS NULL " +
            "AND (:keyword IS NULL OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    Page<DocumentEntity> searchByScopesAndDeletedAtIsNull(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword, Pageable pageable);

    @Query("SELECT d FROM DocumentEntity d WHERE d.scope.scopeId IN :scopeIds " +
            "AND d.deletedAt IS NOT NULL " +
            "AND (:keyword IS NULL OR d.title LIKE %:keyword% OR d.originalContent LIKE %:keyword%)")
    Page<DocumentEntity> searchByScopesAndDeletedAtIsNotNull(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword, Pageable pageable);

    // 30일 이상 지난 삭제된 문서 조회용
    @Query("SELECT d FROM DocumentEntity d WHERE d.deletedAt <= :cutoffDate")
    List<DocumentEntity> findByDeletedAtBefore(@Param("cutoffDate") java.time.LocalDateTime cutoffDate);

    boolean existsByFile(FileItem file);

    @Query("SELECT COUNT(d) > 0 FROM DocumentEntity d WHERE (d.file = :file OR d.previewFile = :file) AND d.docId <> :excludeDocId")
    boolean existsByFileOrPreviewFileExcluding(@Param("file") FileItem file, @Param("excludeDocId") Long excludeDocId);

    void deleteByFile(FileItem file);
    }