package com.ang.Backend.domain.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class DocumentSaveRequest {

    @NotBlank(message = "제목을 입력해주세요.")
    private String title;

    @NotBlank(message = "내용을 입력해주세요.")
    private String content;

    private Boolean isAiGenerated;

    private Integer scopeId;
}
