package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.entity.FileEntity;
import com.ang.Backend.domain.file.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FileService {

    private final FileRepository fileRepository;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Transactional
    public FileEntity storeFile(MultipartFile file) {
        if (file.isEmpty()) throw new CustomException(ErrorCode.INVALID_INPUT);

        String originalName = file.getOriginalFilename();
        String storedName = UUID.randomUUID() + "_" + originalName;
        Path targetPath = Paths.get(uploadDir).resolve(storedName);

        try {
            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());

            FileEntity fileEntity = FileEntity.builder()
                    .originalName(originalName)
                    .storedName(storedName)
                    .filePath(targetPath.toString())
                    .fileSize(file.getSize())
                    .fileType(file.getContentType())
                    .build();

            return fileRepository.save(fileEntity);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    @Transactional
    public void deletePhysicalFile(FileEntity fileEntity) {
        try {
            Path path = Paths.get(fileEntity.getFilePath());
            Files.deleteIfExists(path);
            fileRepository.delete(fileEntity);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    // [이 메서드가 누락되어 에러 발생]
    public FileEntity getFile(Long fileId) {
        return fileRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
    }
}