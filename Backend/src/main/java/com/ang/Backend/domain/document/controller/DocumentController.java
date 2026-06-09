package com.ang.Backend.domain.document.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.service.DocumentService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    public ApiResponse<List<DocumentDto.Response>> getDocuments(@AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ApiResponse.ok(documentService.getAllDocuments(user));
    }

    @PostMapping("/ai-generate")
    public ApiResponse<DocumentDto.Response> generateWithAi(
            @RequestBody DocumentDto.AiGenerateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null && userDetails.getUsername() != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ApiResponse.ok(documentService.generateWithAi(
                request.getPrompt(),
                user,
                request.getSourceDocId(),
                request.getAttachedDocIds(),
                request.getOutputFormat(),
                request.getMode()
        ));
    }

    @GetMapping("/my")
    public ApiResponse<List<DocumentDto.Response>> getMyDocuments(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getMyDocuments(user));
    }

    @GetMapping("/favorites")
    public ApiResponse<List<DocumentDto.Response>> getFavoriteDocuments(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getFavoriteDocuments(user));
    }

    @PostMapping("/{id}/favorite")
    public ApiResponse<Boolean> toggleFavorite(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.toggleFavorite(id, user));
    }

    @GetMapping("/department")
    public ApiResponse<List<DocumentDto.Response>> getDepartmentDocuments(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Integer scopeId,
            @RequestParam(required = false) String keyword) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getDepartmentDocuments(user, scopeId, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDto.Response> getDocument(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = null;
        if (userDetails != null) {
            user = userRepository.findByEmpNo(userDetails.getUsername()).orElse(null);
        }
        return ApiResponse.ok(documentService.getDocument(id, user));
    }

    @GetMapping("/{id}/original-content")
    public ApiResponse<String> getOriginalContent(@PathVariable Long id) {
        return ApiResponse.ok("요청이 성공적으로 처리되었습니다.", documentService.getOriginalContent(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody DocumentDto.UpdateRequest dto) {
        documentService.update(id, dto);
        return ApiResponse.ok(null);
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
    public ApiResponse<List<DocumentDto.Response>> getTrashDocuments(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(documentService.getTrashDocuments(user));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.delete(id, user);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}/permanent")
    public ApiResponse<Void> permanentDelete(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.permanentDelete(id, user);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{id}/restore")
    public ApiResponse<Void> restore(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        documentService.restore(id, user);
        return ApiResponse.ok(null);
    }
}
