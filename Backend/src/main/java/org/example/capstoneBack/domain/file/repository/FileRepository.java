package org.example.capstoneBack.domain.file.repository;

import org.example.capstoneBack.common.enums.TargetType;
import org.example.capstoneBack.domain.file.entity.FileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FileRepository extends JpaRepository<FileEntity, Long> {

    // 개인 파일함 (scope_id is null)
    List<FileEntity> findByUploaderUserIdAndScopeIsNull(Long uploaderId);

    // 부서 공유 파일함
    List<FileEntity> findByScopeScopeId(Long scopeId);

    List<FileEntity> findByTargetTypeAndTargetId(TargetType targetType, Long targetId);
}
