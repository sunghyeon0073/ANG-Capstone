package org.example.capstoneBack.domain.file.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.capstoneBack.common.enums.TargetType;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.file.dto.FileDto;
import org.example.capstoneBack.domain.file.entity.FileEntity;
import org.example.capstoneBack.domain.file.repository.FileRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileRepository fileRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    @Transactional(readOnly = true)
    public List<FileDto> getPersonalFiles(String empNo) {
        User user = findUserByEmpNo(empNo);
        return fileRepository.findByUploaderUserIdAndScopeIsNull(user.getUserId())
                .stream().map(FileDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<FileDto> getDepartmentFiles(Long scopeId) {
        return fileRepository.findByScopeScopeId(scopeId)
                .stream().map(FileDto::from).toList();
    }

    @Transactional
    public FileDto uploadFile(String empNo, Long scopeId, TargetType targetType,
                                  Long targetId, MultipartFile file) {
        User uploader = findUserByEmpNo(empNo);
        Scope scope = null;
        if (scopeId != null) {
            scope = scopeRepository.findById(scopeId)
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }

        String rawName = file.getOriginalFilename();
        String originalName = (rawName != null && !rawName.isBlank())
                ? Paths.get(rawName).getFileName().toString()
                : "unknown";
        String savedFileName = UUID.randomUUID() + "_" + originalName;
        String datePath = LocalDate.now().toString().replace("-", "/");
        Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path savePath = baseDir.resolve(datePath).resolve(savedFileName).normalize();

        if (!savePath.startsWith(baseDir)) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        try {
            Files.createDirectories(savePath.getParent());
            file.transferTo(savePath.toFile());
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        FileEntity fileEntity = FileEntity.builder()
                .uploader(uploader).scope(scope)
                .targetType(targetType != null ? targetType : TargetType.DRIVE)
                .targetId(targetId)
                .originalName(originalName)
                .savedPath(savePath.toString())
                .fileSize(file.getSize())
                .build();
        return FileDto.from(fileRepository.save(fileEntity));
    }

    @Transactional
    public void deleteFile(Long fileId, String empNo, int roleLevel) {
        FileEntity file = fileRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
        User user = findUserByEmpNo(empNo);
        // 업로드한 본인 또는 부서 관리자(roleLevel >= 50)
        if (!file.getUploader().getUserId().equals(user.getUserId()) && roleLevel < 50) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        try {
            Files.deleteIfExists(Paths.get(file.getSavedPath()));
        } catch (IOException e) {
            log.warn("파일 삭제 실패: {}", file.getSavedPath());
        }
        fileRepository.delete(file);
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
