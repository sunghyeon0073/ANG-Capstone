package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileItemRepository fileItemRepository;
    private final UserRepository userRepository;
    private final S3FileService s3FileService;

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
            boolean exists = fileItemRepository.existsByFilePath(filePath);
            if (!exists) {
                FileItem fileItem = FileItem.builder()
                        .originalFileName(file.getName())
                        .storedFileName(file.getName())
                        .filePath(filePath)
                        .fileSize(file.length())
                        .ownerType(OwnerType.USER)
                        .contentType("application/pdf")
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

        String originalFilename = file.getOriginalFilename();
        String s3Key = s3FileService.upload(file);

        FileItem fileItem = FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(s3Key)
                .filePath(s3Key)
                .fileSize(file.getSize())
                .ownerType(ownerType)
                .ownerId(ownerId)
                .uploader(uploader)
                .contentType(file.getContentType())
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
        if (file.isEmpty()) return null;

        String originalFilename = file.getOriginalFilename();
        String s3Key = s3FileService.upload(file);

        return fileItemRepository.save(FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(s3Key)
                .filePath(s3Key)
                .fileSize(file.getSize())
                .uploader(uploader)
                .ownerId(uploader != null ? uploader.getUserId() : null)
                .ownerType(OwnerType.USER)
                .contentType(file.getContentType())
                .build());
    }

    @Transactional
    public void deletePhysicalFile(FileItem fileItem) {
        if (isS3Key(fileItem.getFilePath())) {
            s3FileService.delete(fileItem.getFilePath());
        } else {
            File file = new File(fileItem.getFilePath());
            if (file.exists()) {
                file.delete();
            }
        }
        fileItemRepository.delete(fileItem);
    }

    @Transactional(readOnly = true)
    public Resource loadFileAsResource(Long fileId) {
        try {
            FileItem fileItem = fileItemRepository.findById(fileId)
                    .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));

            if (isS3Key(fileItem.getFilePath())) {
                return new ByteArrayResource(s3FileService.download(fileItem.getFilePath()));
            }

            Path filePath = Paths.get(fileItem.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            }

            throw new CustomException(ErrorCode.NOT_FOUND);
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional(readOnly = true)
    public Resource loadPreviewAsResource(Long fileId) {
        FileItem fileItem = fileItemRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));

        if (!isS3Key(fileItem.getFilePath()) || isBrowserPreviewable(fileItem.getContentType())) {
            return loadFileAsResource(fileId);
        }

        String previewKey = makePreviewPdfKey(fileItem.getFilePath());
        if (!s3FileService.exists(previewKey)) {
            throw new CustomException(ErrorCode.NOT_FOUND);
        }

        return new ByteArrayResource(s3FileService.download(previewKey));
    }

    @Transactional(readOnly = true)
    public FileItem getFileItem(Long fileId) {
        return fileItemRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }

    private boolean isS3Key(String filePath) {
        return filePath != null && filePath.startsWith("uploads/");
    }

    private boolean isBrowserPreviewable(String contentType) {
        return contentType != null && (contentType.startsWith("image/") || contentType.contains("pdf"));
    }

    private String makePreviewPdfKey(String originalKey) {
        String previewKey = originalKey.replaceFirst("^uploads/", "preview/");
        int dotIndex = previewKey.lastIndexOf('.');
        if (dotIndex >= 0) {
            previewKey = previewKey.substring(0, dotIndex);
        }
        return previewKey + ".pdf";
    }
}
