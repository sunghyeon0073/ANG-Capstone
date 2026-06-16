package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.document.repository.FavoriteDocumentRepository;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.domain.file.entity.FavoriteFile;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.file.repository.FavoriteFileRepository;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileItemRepository fileItemRepository;
    private final FavoriteFileRepository favoriteFileRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final S3FileService s3FileService;
    private final DocumentRepository documentRepository;
    private final FavoriteDocumentRepository favoriteDocumentRepository;
    private final com.ang.Backend.domain.document.service.DocumentParser documentParser;

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
    public FileDto.Response uploadFileV2(MultipartFile file, User uploader, OwnerType ownerType, Integer ownerId) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 존재하지 않습니다.");
        }

        String originalFilename = file.getOriginalFilename();
        String storedFileName;
        String filePath;
        
        try {
            storedFileName = s3FileService.upload(file);
            filePath = storedFileName;
        } catch (Exception e) {
            log.warn("S3 upload failed, falling back to local storage: {}", e.getMessage());
            filePath = storeFileLocally(file, uploader, ownerType, ownerId);
            storedFileName = new File(filePath).getName();
        }

        FileItem fileItem = FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .ownerType(ownerType)
                .ownerId(ownerId)
                .uploader(uploader)
                .build();

        FileItem saved = fileItemRepository.save(fileItem);

        String scopeName = "N/A";
        com.ang.Backend.domain.scope.entity.Scope scope = null;
        if (ownerType == OwnerType.SCOPE && ownerId != null) {
            scope = scopeRepository.findById(ownerId).orElse(null);
            if (scope != null) scopeName = scope.getName();
        }

        // Parse content for AI knowledge base
        String parsedContent = documentParser.parseOriginalContent(file);

        com.ang.Backend.domain.document.entity.DocumentEntity doc = com.ang.Backend.domain.document.entity.DocumentEntity.builder()
                .title(originalFilename)
                .file(saved)
                .owner(uploader)
                .scope(scope)
                .status(com.ang.Backend.common.enums.DocumentStatus.DRAFT)
                .originalContent(parsedContent.isBlank() ? "Uploaded via File Storage: " + originalFilename : parsedContent)
                .build();
        documentRepository.save(doc);

        return FileDto.Response.fromEntity(saved, false, scopeName);
    }

    private String storeFileLocally(MultipartFile file, User uploader, OwnerType ownerType, Integer ownerId) throws IOException {
        String customPath = uploadDir;
        if (ownerType == OwnerType.USER && uploader != null) {
            customPath += File.separator + "Users" + File.separator + uploader.getEmpNo();
        } else if (ownerType == OwnerType.SCOPE && ownerId != null) {
            customPath += File.separator + "Scopes" + File.separator + ownerId;
        }

        File directory = new File(customPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String storedFileName = java.util.UUID.randomUUID().toString() + "_" + originalFilename;
        Path targetPath = Paths.get(customPath).resolve(storedFileName);
        
        Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        return targetPath.toAbsolutePath().toString();
    }

    @Transactional
    public FileDto uploadFile(MultipartFile file, Integer uploaderId, OwnerType ownerType, Integer ownerId) throws IOException {
        User uploader = userRepository.findById(uploaderId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        FileDto.Response res = uploadFileV2(file, uploader, ownerType, ownerId);
        return FileDto.builder()
                .fileId(res.getFileId())
                .originalFileName(res.getTitle())
                .contentType(res.getContentType())
                .fileSize(res.getFileSize())
                .ownerType(res.getOwnerType())
                .ownerId(res.getOwnerId())
                .uploaderId(uploaderId)
                .uploadedAt(res.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<FileDto> getFilesByOwner(OwnerType ownerType, Integer ownerId) {
        return fileItemRepository.findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(ownerType, ownerId).stream()
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

        String originalFilename = file.getOriginalFilename();
        String storedFileName;
        String filePath;

        try {
            storedFileName = s3FileService.upload(file);
            filePath = storedFileName;
        } catch (Exception e) {
            log.warn("S3 upload failed in storeFile, falling back to local storage: {}", e.getMessage());
            filePath = storeFileLocallyWithSubPath(file, uploader, subPath);
            storedFileName = new File(filePath).getName();
        }

        return fileItemRepository.save(FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .fileSize(file.getSize())
                .uploader(uploader) // 업로더 정보 저장
                .contentType(file.getContentType())
                .ownerId(uploader != null ? uploader.getUserId() : null)
                .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                .build());
    }

    private String storeFileLocallyWithSubPath(MultipartFile file, User uploader, String subPath) throws IOException {
        String finalPath = uploadDir;
        if (subPath != null && !subPath.isBlank()) {
            finalPath += File.separator + subPath;
        } else if (uploader != null) {
            finalPath += File.separator + "Users" + File.separator + uploader.getEmpNo();
        }

        File directory = new File(finalPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String storedFileName = java.util.UUID.randomUUID().toString() + "_" + originalFilename;
        Path targetPath = Paths.get(finalPath).resolve(storedFileName);
        
        Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        return targetPath.toAbsolutePath().toString();
    }

    public String storeBytesLocally(byte[] bytes, String fileName, String prefix) throws IOException {
        String finalPath = uploadDir + File.separator + prefix + File.separator + java.time.LocalDate.now();
        File directory = new File(finalPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        String storedFileName = java.util.UUID.randomUUID().toString() + "_" + fileName;
        Path targetPath = Paths.get(finalPath).resolve(storedFileName);
        Files.write(targetPath, bytes);
        return targetPath.toAbsolutePath().toString();
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
                    .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
            Path filePath = Paths.get(fileItem.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            }

            if (isS3Key(fileItem.getFilePath())) {
                return new ByteArrayResource(s3FileService.download(fileItem.getFilePath()));
            }

            throw new CustomException(ErrorCode.FILE_NOT_FOUND);
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private boolean isS3Key(String filePath) {
        return filePath != null
                && filePath.matches("^(uploads|documents|previews)/\\d{4}-\\d{2}-\\d{2}/.+")
                && !Paths.get(filePath).isAbsolute();
    }
    
    @Transactional(readOnly = true)
    public FileItem getFileItem(Long fileId) {
        return fileItemRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }

    // --- File Storage API Methods ---

    @Transactional(readOnly = true)
    public FileDto.PagedResponse getMyFiles(User user, String keyword, Pageable pageable) {
        Page<FileItem> page;
        if (keyword != null && !keyword.isBlank()) {
            page = fileItemRepository.findByOwnerTypeAndOwnerIdAndOriginalFileNameContainingIgnoreCaseAndDeletedAtIsNull(
                    OwnerType.USER, user.getUserId(), keyword, pageable);
        } else {
            page = fileItemRepository.findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(
                    OwnerType.USER, user.getUserId(), pageable);
        }
        return toPagedResponse(page, user);
    }

    @Transactional(readOnly = true)
    public FileDto.PagedResponse getAllActiveFiles(User user, Pageable pageable) {
        Page<FileItem> page = fileItemRepository.findAllActiveFiles(pageable);
        return toPagedResponse(page, user);
    }

    private final ScopeService scopeService;

    @Transactional(readOnly = true)
    public FileDto.PagedResponse getDepartmentFiles(User user, Integer targetScopeId, String keyword, Pageable pageable) {
        List<Integer> scopeIds;
        if (targetScopeId != null) {
            scopeIds = List.of(targetScopeId);
        } else {
            // Accessible scopes: Level 2 ancestors and their children
            scopeIds = scopeService.getAccessibleScopes(user).stream()
                    .map(Scope::getScopeId)
                    .collect(Collectors.toList());
        }
        
        if (scopeIds.isEmpty()) {
            return new FileDto.PagedResponse(List.of(), 0, 0, 0, pageable.getPageSize());
        }

        Page<FileItem> page = fileItemRepository.findDepartmentFiles(scopeIds, keyword, pageable);
        return toPagedResponse(page, user);
    }

    @Transactional(readOnly = true)
    public FileDto.PagedResponse getTrashFiles(User user, Pageable pageable) {
        List<Integer> accessibleScopeIds = scopeService.getAccessibleScopes(user).stream()
                .map(Scope::getScopeId)
                .toList();

        Page<FileItem> page = fileItemRepository.findTrashFiles(user.getUserId(), accessibleScopeIds, pageable);
        return toPagedResponse(page, user);
    }

    @Transactional(readOnly = true)
    public FileDto.PagedResponse getFavoriteFiles(User user, Pageable pageable) {
        Page<FileItem> page = favoriteFileRepository.findFavoriteFilesByUser(user, pageable);
        return toPagedResponse(page, user);
    }

    @Transactional
    public boolean toggleFavorite(Long fileId, User user) {
        FileItem fileItem = getFileItem(fileId);
        return favoriteFileRepository.findByUserAndFileItem(user, fileItem)
                .map(fav -> {
                    favoriteFileRepository.delete(fav);
                    return false;
                })
                .orElseGet(() -> {
                    favoriteFileRepository.save(FavoriteFile.builder().user(user).fileItem(fileItem).build());
                    return true;
                });
    }

    @Transactional
    public void deleteToTrash(Long fileId, User user) {
        FileItem fileItem = getFileItem(fileId);
        checkFileOwnership(fileItem, user);
        fileItem.setDeletedAt(LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul")));
    }

    @Transactional
    public void restoreFromTrash(Long fileId, User user) {
        FileItem fileItem = getFileItem(fileId);
        checkFileOwnership(fileItem, user);
        fileItem.setDeletedAt(null);
    }

    @Transactional
    public void permanentDelete(Long fileId, User user) {
        FileItem fileItem = getFileItem(fileId);
        checkFileOwnership(fileItem, user);
        favoriteFileRepository.findByUserAndFileItem(user, fileItem).ifPresent(favoriteFileRepository::delete);
        
        // 연관된 DocumentEntity 삭제 처리
        List<DocumentEntity> relatedDocs = documentRepository.findByFileOrPreviewFile(fileItem, fileItem);
        for (DocumentEntity doc : relatedDocs) {
            favoriteDocumentRepository.deleteByDocument(doc);
            documentRepository.delete(doc);
        }
        documentRepository.flush(); // 제약 조건 충돌 방지를 위해 flush

        deletePhysicalFile(fileItem);
    }

    @Transactional
    public void renameFile(Long fileId, String newTitle, User user) {
        FileItem fileItem = getFileItem(fileId);
        checkFileOwnership(fileItem, user);
        fileItem.setOriginalFileName(newTitle);
    }

    private void checkFileOwnership(FileItem fileItem, User user) {
        if (fileItem.getOwnerType() == OwnerType.USER && !fileItem.getOwnerId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        // Scope owner checks can be added here if needed
    }

    private FileDto.PagedResponse toPagedResponse(Page<FileItem> page, User user) {
        List<FileDto.Response> content = page.getContent().stream().map(f -> {
            boolean isFavorite = favoriteFileRepository.existsByUserAndFileItem(user, f);
            String scopeName = getScopeName(f);
            return FileDto.Response.fromEntity(f, isFavorite, scopeName);
        }).collect(Collectors.toList());

        return FileDto.PagedResponse.builder()
                .content(content)
                .currentPage(page.getNumber())
                .totalPages(page.getTotalPages())
                .totalElements(page.getTotalElements())
                .size(page.getSize())
                .build();
    }

    private String getScopeName(FileItem f) {
        if (f.getOwnerType() == OwnerType.SCOPE && f.getOwnerId() != null) {
            return scopeRepository.findById(f.getOwnerId()).map(Scope::getName).orElse("N/A");
        }
        return "N/A";
    }
}
