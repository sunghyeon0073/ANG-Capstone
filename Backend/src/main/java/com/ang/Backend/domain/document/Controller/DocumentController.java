package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.document.dto.DocumentParseResponse;
import com.ang.Backend.domain.document.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping({"/upload", "/parse"})
    public ApiResponse<DocumentParseResponse> parseDocument(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Document parsed successfully.", documentService.saveAndParse(file));
    }
}
