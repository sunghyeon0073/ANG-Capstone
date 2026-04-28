package org.example.capstoneBack.domain.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class DocumentCreateRequest {

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    private String originalContent;

    private Long scopeId;

    private boolean isAiGenerated;
}
