package com.ang.Backend.domain.document.dto;

import com.ang.Backend.domain.document.entity.Document;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class DocumentDto {

    private Integer docId;
    private String title;
    private String originalContent;
    private String aiSummary;
    private boolean isOcrProcessed;
    private boolean isAiGenerated;
    private LocalDateTime createdAt;

    public static DocumentDto from(Document doc) {
        return DocumentDto.builder()
                .docId(doc.getDocId())
                .title(doc.getTitle())
                .originalContent(doc.getOriginalContent())
                .aiSummary(doc.getAiSummary())
                .isOcrProcessed(doc.isOcrProcessed())
                .isAiGenerated(doc.isAiGenerated())
                .createdAt(doc.getCreatedAt())
                .build();
    }
}
