package com.ang.Backend.domain.file.repository;

import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FileItemRepository extends JpaRepository<FileItem, Long> {
    List<FileItem> findByOwnerTypeAndOwnerId(OwnerType ownerType, Integer ownerId);
}