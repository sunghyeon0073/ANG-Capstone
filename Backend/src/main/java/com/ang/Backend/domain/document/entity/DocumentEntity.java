package com.ang.Backend.domain.document.entity;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.scope.entity.Scope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Getter @Setter @NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor @Builder
public class DocumentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long docId;

    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String originalContent; // 웹 뷰어 수정용 텍스트 (지식 베이스)

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.DRAFT;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id")
    private FileItem file; // 원본 물리 파일

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preview_file_id")
    private FileItem previewFile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id") // User의 userId와 연결
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;

    @Column(name = "is_ai_generated")
    @Builder.Default
    private Boolean isAiGenerated = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public void updateContent(String title, String content) {
        this.title = title;
        this.originalContent = content;
    }
}
