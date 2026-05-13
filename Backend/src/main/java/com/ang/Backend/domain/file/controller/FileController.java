package com.ang.Backend.domain.file.Controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.file.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    // 기능정의서 File-01-1: 파일 업로드
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
            // 프로젝트 전역 예외 처리 로직이 있다면 그에 맞게 수정
            throw new RuntimeException("파일 업로드 실패: " + e.getMessage());
        }
    }

    // 기능정의서 File-01-4: 파일 리스트 조회 (개인 또는 부서 전체 파일 관리)
    @GetMapping
    public ResponseEntity<ApiResponse<List<FileDto>>> getFiles(
            @RequestParam("ownerType") OwnerType ownerType,
            @RequestParam("ownerId") Integer ownerId) {
        List<FileDto> files = fileService.getFilesByOwner(ownerType, ownerId);
        return ResponseEntity.ok(ApiResponse.ok(files));
    }
}