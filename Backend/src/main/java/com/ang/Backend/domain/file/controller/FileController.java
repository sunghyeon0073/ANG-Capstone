package com.ang.Backend.domain.file.controller;

import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileDto>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("uploaderId") Integer uploaderId,
            @RequestParam("ownerType") OwnerType ownerType,
            @RequestParam("ownerId") Integer ownerId) {
        try {
            FileDto uploadedFile = fileService.uploadFile(file, uploaderId, ownerType, ownerId);
            return ResponseEntity.ok(ApiResponse.ok(uploadedFile));
        } catch (Exception e) {
            throw new RuntimeException("파일 업로드 실패: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<FileDto>>> getFiles(
            @RequestParam("ownerType") OwnerType ownerType,
            @RequestParam("ownerId") Integer ownerId) {
        List<FileDto> files = fileService.getFilesByOwner(ownerType, ownerId);
        return ResponseEntity.ok(ApiResponse.ok(files));
    }

    @GetMapping("/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        Resource resource = fileService.loadFileAsResource(fileId);
        FileItem fileItem = fileService.getFileItem(fileId);

        String encodedFileName = URLEncoder.encode(fileItem.getOriginalFileName(), StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        String contentDisposition = "attachment; filename=\"" + encodedFileName + "\"";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .body(resource);
    }

    @GetMapping("/stream/{fileId}")
    public ResponseEntity<Resource> streamFile(@PathVariable Long fileId) {
        Resource resource = fileService.loadFileAsResource(fileId);
        FileItem fileItem = fileService.getFileItem(fileId);

        String encodedFileName = URLEncoder.encode(fileItem.getOriginalFileName(), StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        String contentDisposition = "inline; filename=\"" + encodedFileName + "\"";

        MediaType mediaType;
        try {
            mediaType = fileItem.getContentType() != null
                    ? MediaType.parseMediaType(fileItem.getContentType())
                    : MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception ex) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .body(resource);
    }

    @GetMapping("/preview/{fileId}")
    public ResponseEntity<Resource> previewFile(@PathVariable Long fileId) {
        Resource resource = fileService.loadPreviewAsResource(fileId);
        FileItem fileItem = fileService.getFileItem(fileId);

        String encodedFileName = URLEncoder.encode(fileItem.getOriginalFileName(), StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        String contentDisposition = "inline; filename=\"" + encodedFileName + "\"";

        return ResponseEntity.ok()
                .contentType(resolvePreviewMediaType(fileItem))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .body(resource);
    }

    private MediaType resolvePreviewMediaType(FileItem fileItem) {
        String contentType = fileItem.getContentType();

        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_PDF;
        }

        try {
            if (contentType.startsWith("image/") || contentType.contains("pdf")) {
                return MediaType.parseMediaType(contentType);
            }
        } catch (Exception ignored) {
            return MediaType.APPLICATION_PDF;
        }

        return MediaType.APPLICATION_PDF;
    }
}
