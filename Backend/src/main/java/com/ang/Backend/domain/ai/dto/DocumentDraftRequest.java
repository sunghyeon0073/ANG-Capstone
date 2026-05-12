package com.ang.Backend.domain.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class DocumentDraftRequest {

    @NotBlank(message = "문서 양식을 입력해주세요.")
    private String templateType;

    @NotBlank(message = "작성 내용을 입력해주세요.")
    private String details;
}
