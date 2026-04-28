package org.example.capstoneBack.domain.file.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.common.enums.TargetType;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "files")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class FileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "file_id")
    private Long fileId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploader_id", nullable = false)
    private User uploader;

    // NULL: 개인 파일함, 값 존재: 부서 공유 파일함
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false)
    private TargetType targetType;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;

    @Column(name = "saved_path", nullable = false, length = 500)
    private String savedPath;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
