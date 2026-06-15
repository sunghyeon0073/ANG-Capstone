package com.ang.Backend.domain.file.controller;

import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.service.FileService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final UserRepository userRepository;

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileDto.Response>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "targetScopeId", required = false) Integer targetScopeId,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = getUser(userDetails);
            OwnerType ownerType = targetScopeId != null ? OwnerType.SCOPE : OwnerType.USER;
            Integer ownerId = targetScopeId != null ? targetScopeId : user.getUserId();
            FileDto.Response uploadedFile = fileService.uploadFileV2(file, user, ownerType, ownerId);
            return ResponseEntity.ok(ApiResponse.success(uploadedFile));
        } catch (Exception e) {
            throw new RuntimeException("파일 업로드 실패: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<FileDto.PagedResponse>> getAllFiles(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "uploadedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.getAllActiveFiles(user, pageable)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<FileDto.PagedResponse>> getMyFiles(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "uploadedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.getMyFiles(user, keyword, pageable)));
    }

    @GetMapping("/department")
    public ResponseEntity<ApiResponse<FileDto.PagedResponse>> getDepartmentFiles(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Integer scopeId,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "uploadedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.getDepartmentFiles(user, scopeId, keyword, pageable)));
    }

    @GetMapping("/trash")
    public ResponseEntity<ApiResponse<FileDto.PagedResponse>> getTrashFiles(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "deletedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.getTrashFiles(user, pageable)));
    }

    @GetMapping("/favorites")
    public ResponseEntity<ApiResponse<FileDto.PagedResponse>> getFavoriteFiles(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "uploadedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.getFavoriteFiles(user, pageable)));
    }

    @PostMapping("/{id}/favorite")
    public ResponseEntity<ApiResponse<Boolean>> toggleFavorite(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(fileService.toggleFavorite(id, user)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteToTrash(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        fileService.deleteToTrash(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<ApiResponse<Void>> permanentDelete(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        fileService.permanentDelete(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<Void>> restoreFromTrash(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        fileService.restoreFromTrash(id, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> renameFile(@PathVariable Long id, @RequestBody java.util.Map<String, String> body, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        fileService.renameFile(id, body.get("title"), user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // 파일 다운로드 기능
    @GetMapping("/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        Resource resource = fileService.loadFileAsResource(fileId);
        FileItem fileItem = fileService.getFileItem(fileId);
        
        String encodedFileName = URLEncoder.encode(fileItem.getOriginalFileName(), StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"; filename*=UTF-8''" + encodedFileName)
                .body(resource);
    }

    @GetMapping("/preview/{fileId}")
    public ResponseEntity<Resource> getFilePreview(@PathVariable Long fileId) {
        Resource resource = fileService.loadFileAsResource(fileId);
        FileItem fileItem = fileService.getFileItem(fileId);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(fileItem.getContentType()))
                .body(resource);
    }
}
