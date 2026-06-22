package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.service.DocumentService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {
    private final DocumentService documentService;
    private final UserRepository userRepository;

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<Void>> syncFiles() {
        documentService.manualSync();
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDto.Response>> create(@RequestParam String title,
                                                   @RequestPart MultipartFile file,
                                                   @RequestParam(required = false) String targetScopeId,
                                                   @AuthenticationPrincipal UserDetails userDetails) throws Exception {
        User user = null;
        if (userDetails != null && userDetails.getUsername() != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }

        Integer scopeId = (targetScopeId != null && !targetScopeId.isEmpty())
                ? Integer.parseInt(targetScopeId) : null;

        return ResponseEntity.ok(ApiResponse.success(documentService.create(title, file, user, scopeId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<DocumentDto.PagedResponse>> getDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = null;
        if (userDetails != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ResponseEntity.ok(ApiResponse.success(documentService.getAllDocuments(user, pageable)));
    }

    @PostMapping("/ai-generate")
    public ResponseEntity<ApiResponse<DocumentDto.Response>> generateWithAi(
            @Valid @RequestBody DocumentDto.AiGenerateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null && userDetails.getUsername() != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ResponseEntity.ok(ApiResponse.success(documentService.generateWithAi(
                request.getPrompt(),
                user,
                request.getSourceDocId(),
                request.getAttachedDocIds(),
                request.getOutputFormat(),
                request.getMode()
        )));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<DocumentDto.PagedResponse>> getMyDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.success(documentService.getMyDocuments(user, keyword, pageable)));
    }

    @GetMapping("/favorites")
    public ResponseEntity<ApiResponse<DocumentDto.PagedResponse>> getFavoriteDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.success(documentService.getFavoriteDocuments(user, pageable)));
    }

    @PostMapping("/{id}/favorite")
    public ResponseEntity<ApiResponse<Boolean>> toggleFavorite(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.success(documentService.toggleFavorite(id, user)));
    }

    @GetMapping("/department")
    public ResponseEntity<ApiResponse<DocumentDto.PagedResponse>> getDepartmentDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Integer scopeId,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.success(documentService.getDepartmentDocuments(user, scopeId, keyword, pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentDto.Response>> getDocument(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ResponseEntity.ok(ApiResponse.success(documentService.getDocument(id, user)));
    }

    @GetMapping("/{id}/original-content")
    public ResponseEntity<ApiResponse<String>> getOriginalContent(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("요청이 성공적으로 처리되었습니다.", documentService.getOriginalContent(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> update(@PathVariable Long id, @RequestBody DocumentDto.UpdateRequest dto) {
        documentService.update(id, dto);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/hwp-replace")
    public ResponseEntity<byte[]> replaceHwp(
            @PathVariable Long id,
            @RequestBody DocumentDto.HwpReplaceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        DocumentDto.FileDownload file = documentService.replaceHwp(id, request, user);

        String contentType = file.getContentType() != null
                ? file.getContentType()
                : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.getFileName(), java.nio.charset.StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(file.getBytes());
    }

    @GetMapping("/trash")
    public ResponseEntity<ApiResponse<DocumentDto.PagedResponse>> getTrashDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "deletedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.success(documentService.getTrashDocuments(user, pageable)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.delete(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<ApiResponse<Void>> permanentDelete(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.permanentDelete(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<Void>> restore(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.restore(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
