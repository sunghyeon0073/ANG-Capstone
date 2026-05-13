package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FileService {

    private final FileItemRepository fileItemRepository;
    private final UserRepository userRepository;

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    @Transactional
    public FileDto uploadFile(MultipartFile file, Integer uploaderId, OwnerType ownerType, Integer ownerId) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 존재하지 않습니다.");
        }

        User uploader = userRepository.findById(uploaderId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        File directory = new File(uploadDir);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String storedFileName = UUID.randomUUID().toString() + "_" + originalFilename;
        String filePath = uploadDir + File.separator + storedFileName;

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
        if (file.isEmpty()) return null;

        File directory = new File(uploadDir).getAbsoluteFile();
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
}