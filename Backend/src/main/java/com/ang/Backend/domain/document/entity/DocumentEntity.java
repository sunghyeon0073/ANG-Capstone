package com.ang.Backend.domain.document.entity;

import com.ang.Backend.domain.file.entity.FileEntity;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.scope.entity.Scope;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "documents")
@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor @Builder
public class DocumentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long docId;

    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String originalContent; // 웹 뷰어 수정용 텍스트 (지식 베이스)

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id")
    private FileEntity file; // 원본 물리 파일

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id") // User의 userId와 연결
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;

    public void updateContent(String title, String content) {
        this.title = title;
        this.originalContent = content;
    }
}