package org.example.capstoneBack.domain.document.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.document.dto.DocumentCreateRequest;
import org.example.capstoneBack.domain.document.dto.DocumentDto;
import org.example.capstoneBack.domain.document.service.DocumentService;
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

    /** AI-01: 내 문서 목록 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<DocumentDto>>> getMyDocuments(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.getMyDocuments(userDetails.getUsername())));
    }

    /** 문서 단건 조회 */
    @GetMapping("/{docId}")
    public ResponseEntity<ApiResponse<DocumentDto>> getDocument(@PathVariable Long docId) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.getDocument(docId)));
    }

    /** AI-01-2: 문서 작성 (AI 초안 포함) */
    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDto>> createDocument(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody DocumentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(documentService.createDocument(userDetails.getUsername(), request)));
    }

    /** AI-01-3: 문서 수정 */
    @PatchMapping("/{docId}")
    public ResponseEntity<ApiResponse<DocumentDto>> updateDocument(
            @PathVariable Long docId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String content) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.updateDocument(docId, userDetails.getUsername(), title, content)));
    }

    /** 문서 삭제 */
    @DeleteMapping("/{docId}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(
            @PathVariable Long docId,
            @AuthenticationPrincipal UserDetails userDetails) {
        documentService.deleteDocument(docId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("문서가 삭제되었습니다."));
    }

    /** AI-01-5: OCR 결과 저장 */
    @PostMapping("/{docId}/ocr")
    public ResponseEntity<ApiResponse<DocumentDto>> applyOcr(
            @PathVariable Long docId,
            @RequestParam String ocrText) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.applyOcr(docId, ocrText)));
    }

    /** 문서 검색 */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<DocumentDto>>> searchDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String keyword) {
        return ResponseEntity.ok(ApiResponse.ok(
                documentService.searchDocuments(userDetails.getUsername(), keyword)));
    }
}
