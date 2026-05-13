package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.service.DocumentService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {
    private final DocumentService documentService;
    private final UserRepository userRepository;

    @PostMapping("/sync")
    public ApiResponse<Void> syncFiles() {
        documentService.manualSync();
        return ApiResponse.ok(null);
    }

    @PostMapping
    public ApiResponse<Long> create(@RequestParam String title,
                                    @RequestPart MultipartFile file,
                                    @RequestParam(required = false) String targetScopeId,
                                    @AuthenticationPrincipal UserDetails userDetails) throws Exception {
        User user = null;
        if (userDetails != null && userDetails.getUsername() != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }

        Integer scopeId = (targetScopeId != null && !targetScopeId.isEmpty())
                ? Integer.parseInt(targetScopeId) : null;

        return ApiResponse.ok(documentService.create(title, file, user, scopeId));
    }

    @GetMapping
    public ApiResponse<List<DocumentDto.Response>> getDocuments() {
        return ApiResponse.ok(documentService.getAllDocuments());
    }

    @PostMapping("/ai-generate")
    public ApiResponse<DocumentDto.Response> generateWithAi(
            @RequestBody DocumentDto.AiGenerateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null && userDetails.getUsername() != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ApiResponse.ok(documentService.generateWithAi(request.getPrompt(), user));
    }

    @GetMapping("/my")
    public ApiResponse<List<DocumentDto.Response>> getMyDocuments(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getMyDocuments(user));
    }

    @GetMapping("/department")
    public ApiResponse<List<DocumentDto.Response>> getDepartmentDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Integer scopeId,
            @RequestParam(required = false) String keyword) {
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getDepartmentDocuments(user, scopeId, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDto.Response> getDocument(@PathVariable Long id) {
        return ApiResponse.ok(documentService.getDocument(id));
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
