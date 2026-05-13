package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.dto.DocumentSaveRequest;
import com.ang.Backend.domain.document.service.DocumentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DocumentDto>>> getMyDocuments(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.getMyDocuments(userDetails.getUsername())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDto>> saveDocument(
            @Valid @RequestBody DocumentSaveRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        DocumentDto saved = documentService.saveDocument(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("문서가 저장되었습니다.", saved));
    }

    @PostMapping("/ocr")
    public ResponseEntity<ApiResponse<DocumentDto>> saveOcrDocument(
            @Valid @RequestBody OcrSaveRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        DocumentDto saved = documentService.saveOcrDocument(
                userDetails.getUsername(), request.getTitle(), request.getContent());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("OCR 문서가 저장되었습니다.", saved));
    }

    @Getter
    static class OcrSaveRequest {
        @NotBlank(message = "제목을 입력해주세요.")
        private String title;
        @NotBlank(message = "내용을 입력해주세요.")
        private String content;
    }
}
