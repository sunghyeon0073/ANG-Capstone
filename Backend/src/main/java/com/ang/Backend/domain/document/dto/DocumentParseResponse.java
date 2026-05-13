package com.ang.Backend.domain.document.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DocumentParseResponse {

    private final String savedName;
    private final String filePath;
    private final String aiResponse;
}
