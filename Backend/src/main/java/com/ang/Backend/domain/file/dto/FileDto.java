package com.ang.Backend.domain.file.dto;

import lombok.*;

public class FileDto {

    @Getter
    @Builder
    public static class Response {
        private Long fileId;
        private String originalName;
        private Long fileSize;
        private String fileType;
        private String uploadDate;
    }
}