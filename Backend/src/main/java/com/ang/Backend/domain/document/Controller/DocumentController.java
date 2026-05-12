package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {
    private final DocumentService documentService;

    @PostMapping
    public ApiResponse<Long> create(@RequestParam String title, @RequestPart MultipartFile file) throws Exception {
        // 테스트용으로 user는 null 전달 (시큐리티 해제 상태)
        return ApiResponse.ok(documentService.create(title, file, null));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody DocumentDto.UpdateRequest dto) {
        documentService.update(id, dto);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        documentService.delete(id);
        return ApiResponse.ok(null);
    }
}