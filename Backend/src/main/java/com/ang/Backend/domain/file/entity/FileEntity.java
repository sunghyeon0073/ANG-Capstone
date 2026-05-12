package com.ang.Backend.domain.file.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name = "files")
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @AllArgsConstructor @Builder
public class FileEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long fileId;
    private String originalName;
    private String storedName;
    private String filePath;
    private Long fileSize;
    private String fileType;
    private LocalDateTime createdAt;
    @PrePersist public void prePersist() { this.createdAt = LocalDateTime.now(); }
}