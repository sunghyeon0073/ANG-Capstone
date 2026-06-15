package com.ang.Backend.domain.file.dto;

import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class FileDto {
    private Long fileId;
    private String originalFileName;
    private String contentType;
    private Long fileSize;
    private OwnerType ownerType;
    private Integer ownerId;
    private Integer uploaderId;
    private LocalDateTime uploadedAt;

    public static FileDto from(FileItem fileItem) {
        return FileDto.builder()
                .fileId(fileItem.getFileId())
                .originalFileName(fileItem.getOriginalFileName())
                .contentType(fileItem.getContentType())
                .fileSize(fileItem.getFileSize())
                .ownerType(fileItem.getOwnerType())
                .ownerId(fileItem.getOwnerId())
                .uploaderId(fileItem.getUploader() != null ? fileItem.getUploader().getUserId() : null)
                .uploadedAt(fileItem.getUploadedAt())
                .build();
    }

    @Getter @Builder
    public static class Response {
        private Long fileId;
        private String title;
        private String contentType;
        private Long fileSize;
        private OwnerType ownerType;
        private Integer ownerId;
        private String ownerName;
        private String scopeName;
        private LocalDateTime createdAt;
        private LocalDateTime deletedAt;
        
        @JsonProperty("isFavorite")
        private boolean isFavorite;

        public static Response fromEntity(FileItem entity, boolean isFavorite, String scopeName) {
            return Response.builder()
                    .fileId(entity.getFileId())
                    .title(entity.getOriginalFileName())
                    .contentType(entity.getContentType())
                    .fileSize(entity.getFileSize())
                    .ownerType(entity.getOwnerType())
                    .ownerId(entity.getOwnerId())
                    .ownerName(entity.getUploader() != null ? entity.getUploader().getName() : "Unknown")
                    .scopeName(scopeName)
                    .createdAt(entity.getUploadedAt())
                    .deletedAt(entity.getDeletedAt())
                    .isFavorite(isFavorite)
                    .build();
        }

        public void setFavorite(boolean favorite) {
            this.isFavorite = favorite;
        }
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedResponse {
        private List<Response> content;
        private int currentPage;
        private int totalPages;
        private long totalElements;
        private int size;
    }
}