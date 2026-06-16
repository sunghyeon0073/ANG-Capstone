package com.ang.Backend.domain.file.repository;

import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FileItemRepository extends JpaRepository<FileItem, Long> {
    List<FileItem> findByOwnerTypeAndOwnerId(OwnerType ownerType, Integer ownerId);
    List<FileItem> findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(OwnerType ownerType, Integer ownerId);
    List<FileItem> findByOwnerTypeAndOwnerIdInAndDeletedAtIsNull(OwnerType ownerType, List<Integer> ownerIds);
    boolean existsByFilePath(String filePath);
    Optional<FileItem> findByFilePath(String filePath);
    List<FileItem> findByOwnerType(OwnerType ownerType);

    @Query("SELECT f FROM FileItem f WHERE f.ownerType = 'USER' AND f.ownerId = :userId AND f.originalFileName LIKE %:keyword% AND f.deletedAt IS NULL ORDER BY f.uploadedAt DESC")
    List<FileItem> findByUserAndKeyword(@Param("userId") Integer userId, @Param("keyword") String keyword);

    // Pageable queries for File Storage
    Page<FileItem> findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(OwnerType ownerType, Integer ownerId, Pageable pageable);
    Page<FileItem> findByOwnerTypeAndOwnerIdAndOriginalFileNameContainingIgnoreCaseAndDeletedAtIsNull(OwnerType ownerType, Integer ownerId, String keyword, Pageable pageable);
    
    Page<FileItem> findByOwnerTypeAndOwnerIdAndDeletedAtIsNotNull(OwnerType ownerType, Integer ownerId, Pageable pageable);

    @Query("SELECT f FROM FileItem f WHERE f.deletedAt IS NOT NULL AND " +
           "((f.ownerType = 'USER' AND f.ownerId = :userId) OR " +
           "(f.ownerType = 'SCOPE' AND f.ownerId IN :scopeIds))")
    Page<FileItem> findTrashFiles(@Param("userId") Integer userId, @Param("scopeIds") List<Integer> scopeIds, Pageable pageable);
    
    @Query("SELECT f FROM FileItem f WHERE f.ownerType = 'SCOPE' AND f.ownerId IN :scopeIds AND f.deletedAt IS NULL AND (:keyword IS NULL OR LOWER(f.originalFileName) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<FileItem> findDepartmentFiles(@Param("scopeIds") List<Integer> scopeIds, @Param("keyword") String keyword, Pageable pageable);
    
    @Query("SELECT f FROM FileItem f WHERE f.deletedAt IS NULL")
    Page<FileItem> findAllActiveFiles(Pageable pageable);
}