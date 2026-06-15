package com.ang.Backend.domain.file.repository;

import com.ang.Backend.domain.file.entity.FavoriteFile;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface FavoriteFileRepository extends JpaRepository<FavoriteFile, Long> {
    boolean existsByUserAndFileItem(User user, FileItem fileItem);
    Optional<FavoriteFile> findByUserAndFileItem(User user, FileItem fileItem);

    @Query("SELECT f.fileItem FROM FavoriteFile f WHERE f.user = :user AND f.fileItem.deletedAt IS NULL")
    Page<FileItem> findFavoriteFilesByUser(@Param("user") User user, Pageable pageable);
}
