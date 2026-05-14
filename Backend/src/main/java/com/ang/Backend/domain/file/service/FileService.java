package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileItemRepository fileItemRepository;
    private final UserRepository userRepository;

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    @PostConstruct
    @Transactional
    public void syncPdfFilesFromUploadsDir() {
        File directory = new File(uploadDir);
        if (!directory.exists()) {
            directory.mkdirs();
            return;
        }

        File[] files = directory.listFiles((dir, name) -> name.toLowerCase().endsWith(".pdf"));
        if (files == null) return;

        for (File file : files) {
            String filePath = file.getAbsolutePath();
            // DB에 존재하는지 확인
            boolean exists = fileItemRepository.existsByFilePath(filePath);
            if (!exists) {
                FileItem fileItem = FileItem.builder()
                        .originalFileName(file.getName())
                        .storedFileName(file.getName())
                        .filePath(filePath)
                        .fileSize(file.length())
                        .ownerType(OwnerType.USER)
                        .build();
                fileItemRepository.save(fileItem);
                log.info("Synced PDF to DB: {}", file.getName());
            }
        }
    }

    @Transactional
    public FileDto uploadFile(MultipartFile file, Integer uploaderId, OwnerType ownerType, Integer ownerId) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 존재하지 않습니다.");
        }

        User uploader = userRepository.findById(uploaderId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        String customPath = uploadDir;
        if (ownerType == OwnerType.USER) {
            customPath += File.separator + "Users" + File.separator + uploader.getEmpNo();
        } else if (ownerType == OwnerType.SCOPE) {
            // Scope 전용 경로 로직 (필요 시 추가)
        }

        File directory = new File(customPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String storedFileName = UUID.randomUUID().toString() + "_" + originalFilename;
        String filePath = customPath + File.separator + storedFileName;

        // 실제 파일을 서버 경로에 저장
        file.transferTo(new File(filePath));

        // DB에 파일 메타데이터 저장
        FileItem fileItem = FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .fileSize(file.getSize())
                .ownerType(ownerType)
                .ownerId(ownerId)
                .uploader(uploader)
                .build();

        return FileDto.from(fileItemRepository.save(fileItem));
    }

    @Transactional(readOnly = true)
    public List<FileDto> getFilesByOwner(OwnerType ownerType, Integer ownerId) {
        return fileItemRepository.findByOwnerTypeAndOwnerId(ownerType, ownerId).stream()
                .map(FileDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public FileItem storeFile(MultipartFile file, User uploader) throws IOException {
        return storeFile(file, uploader, null);
    }

    @Transactional
    public FileItem storeFile(MultipartFile file, User uploader, String subPath) throws IOException {
        if (file.isEmpty()) return null;

        String finalPath = uploadDir;
        if (subPath != null && !subPath.isBlank()) {
            finalPath += File.separator + subPath;
        } else if (uploader != null) {
            finalPath += File.separator + "Users" + File.separator + uploader.getEmpNo();
        }

        File directory = new File(finalPath).getAbsoluteFile();
        if (!directory.exists()) directory.mkdirs();

        String originalFilename = file.getOriginalFilename();
        String storedFileName = UUID.randomUUID().toString() + "_" + originalFilename;
        String filePath = directory.getAbsolutePath() + File.separator + storedFileName;

        file.transferTo(new File(filePath));

        return fileItemRepository.save(FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .fileSize(file.getSize())
                .uploader(uploader) // 업로더 정보 저장
                .ownerId(uploader != null ? uploader.getUserId() : null)
                .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                .build());
    }

    @Transactional
    public void deletePhysicalFile(FileItem fileItem) {
        File file = new File(fileItem.getFilePath());
        if (file.exists()) {
            file.delete();
        }
        fileItemRepository.delete(fileItem);
    }
    
    @Transactional(readOnly = true)
    public Resource loadFileAsResource(Long fileId) {
        try {
            FileItem fileItem = fileItemRepository.findById(fileId)
                    .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND)); // or a specific FILE_NOT_FOUND
            Path filePath = Paths.get(fileItem.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new CustomException(ErrorCode.NOT_FOUND);
            }
        } catch (Exception ex) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }
    
    @Transactional(readOnly = true)
    public FileItem getFileItem(Long fileId) {
        return fileItemRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }
}
