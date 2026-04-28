package org.example.capstoneBack.domain.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.domain.document.entity.Document;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class DocumentDto {

    private Long docId;
    private Long ownerId;
    private String ownerName;
    private Long scopeId;
    private String title;
    private String originalContent;
    private String aiSummary;
    private boolean isOcrProcessed;
    private boolean isAiGenerated;
    private LocalDateTime createdAt;

    public static DocumentDto from(Document doc) {
        return DocumentDto.builder()
                .docId(doc.getDocId())
                .ownerId(doc.getOwner().getUserId())
                .ownerName(doc.getOwner().getName())
                .scopeId(doc.getScope() != null ? doc.getScope().getScopeId() : null)
                .title(doc.getTitle())
                .originalContent(doc.getOriginalContent())
                .aiSummary(doc.getAiSummary())
                .isOcrProcessed(doc.isOcrProcessed())
                .isAiGenerated(doc.isAiGenerated())
                .createdAt(doc.getCreatedAt())
                .build();
    }
}
