package org.example.capstoneBack.domain.file.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.TargetType;
import org.example.capstoneBack.domain.file.entity.FileEntity;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class FileDto {

    private Long fileId;
    private Long uploaderId;
    private String uploaderName;
    private Long scopeId;
    private TargetType targetType;
    private Long targetId;
    private String originalName;
    private long fileSize;
    private LocalDateTime createdAt;

    public static FileDto from(FileEntity file) {
        return FileDto.builder()
                .fileId(file.getFileId())
                .uploaderId(file.getUploader().getUserId())
                .uploaderName(file.getUploader().getName())
                .scopeId(file.getScope() != null ? file.getScope().getScopeId() : null)
                .targetType(file.getTargetType())
                .targetId(file.getTargetId())
                .originalName(file.getOriginalName())
                .fileSize(file.getFileSize())
                .createdAt(file.getCreatedAt())
                .build();
    }
}
