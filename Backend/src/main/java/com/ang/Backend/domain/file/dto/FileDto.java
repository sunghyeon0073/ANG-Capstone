package com.ang.Backend.domain.file.dto;

import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class FileDto {
    private Long fileId;
    private String originalFileName;
    private Long fileSize;
    private OwnerType ownerType;
    private Integer ownerId;
    private Integer uploaderId;
    private LocalDateTime uploadedAt;

    public static FileDto from(FileItem fileItem) {
        return FileDto.builder()
                .fileId(fileItem.getFileId())
                .originalFileName(fileItem.getOriginalFileName())
                .fileSize(fileItem.getFileSize())
                .ownerType(fileItem.getOwnerType())
                .ownerId(fileItem.getOwnerId())
                .uploaderId(fileItem.getUploader() != null ? fileItem.getUploader().getUserId() : null)
                .uploadedAt(fileItem.getUploadedAt())
                .build();
    }
}