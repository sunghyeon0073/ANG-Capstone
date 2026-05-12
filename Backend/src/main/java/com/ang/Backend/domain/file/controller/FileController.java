package com.ang.Backend.domain.file.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.file.entity.FileEntity;
import com.ang.Backend.domain.file.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    // 파일 다운로드 API
    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) throws MalformedURLException {
        FileEntity fileEntity = fileService.getFile(fileId);
        Path path = Paths.get(fileEntity.getFilePath());
        Resource resource = new UrlResource(path.toUri());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileEntity.getOriginalName() + "\"")
                .body(resource);
    }
}