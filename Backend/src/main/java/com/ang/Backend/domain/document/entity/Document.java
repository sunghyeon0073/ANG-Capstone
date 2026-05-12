package com.ang.Backend.domain.document.entity;

import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "doc_id")
    private Integer docId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "original_content", columnDefinition = "TEXT")
    private String originalContent;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "is_ocr_processed")
    @Builder.Default
    private boolean isOcrProcessed = false;

    @Column(name = "is_ai_generated")
    @Builder.Default
    private boolean isAiGenerated = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
