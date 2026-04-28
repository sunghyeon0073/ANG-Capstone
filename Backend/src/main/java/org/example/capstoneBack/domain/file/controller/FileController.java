package org.example.capstoneBack.domain.file.controller;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.TargetType;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.file.dto.FileDto;
import org.example.capstoneBack.domain.file.service.FileService;
import org.example.capstoneBack.domain.user.repository.UserRoleRepository;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    /** File-01: 개인 파일함 조회 */
    @GetMapping("/personal")
    public ResponseEntity<ApiResponse<List<FileDto>>> getPersonalFiles(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                fileService.getPersonalFiles(userDetails.getUsername())));
    }

    /** File-01-4: 부서 공유 파일함 조회 */
    @GetMapping("/department")
    public ResponseEntity<ApiResponse<List<FileDto>>> getDepartmentFiles(
            @RequestParam Long scopeId) {
        return ResponseEntity.ok(ApiResponse.ok(fileService.getDepartmentFiles(scopeId)));
    }

    /** File-01-1: 파일 업로드 (HWP, PDF, Excel, 이미지) */
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileDto>> uploadFile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Long scopeId,
            @RequestParam(required = false) TargetType targetType,
            @RequestParam(required = false) Long targetId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(fileService.uploadFile(
                        userDetails.getUsername(), scopeId, targetType, targetId, file)));
    }

    /** 파일 삭제 (업로드한 본인 또는 부서 관리자) */
    @DeleteMapping("/{fileId}")
    public ResponseEntity<ApiResponse<Void>> deleteFile(
            @PathVariable Long fileId,
            @AuthenticationPrincipal UserDetails userDetails) {
        int roleLevel = getRoleLevel(userDetails.getUsername());
        fileService.deleteFile(fileId, userDetails.getUsername(), roleLevel);
        return ResponseEntity.ok(ApiResponse.ok("파일이 삭제되었습니다."));
    }

    private int getRoleLevel(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .map(u -> {
                    Integer level = userRoleRepository.findMaxRoleLevelByUserId(u.getUserId());
                    return level != null ? level : 0;
                }).orElse(0);
    }
}
