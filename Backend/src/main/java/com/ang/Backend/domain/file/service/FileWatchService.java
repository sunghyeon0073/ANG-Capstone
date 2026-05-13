package com.ang.Backend.domain.file.service;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static java.nio.file.StandardWatchEventKinds.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileWatchService {

    private final FileItemRepository fileItemRepository;
    private final DocumentRepository documentRepository;
    private final ScopeRepository scopeRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    private WatchService watcher;
    private Thread watchThread;
    private final Map<WatchKey, Path> keyToPath = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        ensureBaseDirectories();
        syncExistingFiles();
        startWatcher();
    }

    // ── 물리 폴더 자동 생성 ────────────────────────────────────────────────

    public void ensureBaseDirectories() {
        createDir(Paths.get(uploadDir, "Scopes"));
        createDir(Paths.get(uploadDir, "Users"));

        scopeRepository.findAll().forEach(scope ->
                createDir(Paths.get(uploadDir, "Scopes", scope.getScopeCode())));

        userRepository.findAll().forEach(user ->
                createDir(Paths.get(uploadDir, "Users", user.getEmpNo())));
    }

    public void createScopeFolder(String scopeCode) {
        createDir(Paths.get(uploadDir, "Scopes", scopeCode));
        registerDirectory(Paths.get(uploadDir, "Scopes", scopeCode));
    }

    public void createUserFolder(String empNo) {
        createDir(Paths.get(uploadDir, "Users", empNo));
        registerDirectory(Paths.get(uploadDir, "Users", empNo));
    }

    // ── 시작 시 기존 파일 DB 동기화 ────────────────────────────────────────

    private void syncExistingFiles() {
        syncDirectory(Paths.get(uploadDir, "Scopes"), OwnerType.SCOPE);
        syncDirectory(Paths.get(uploadDir, "Users"), OwnerType.USER);
    }

    private void syncDirectory(Path baseDir, OwnerType ownerType) {
        if (!Files.exists(baseDir)) return;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(baseDir)) {
            for (Path subDir : stream) {
                if (!Files.isDirectory(subDir)) continue;
                String ownerKey = subDir.getFileName().toString();
                try (DirectoryStream<Path> files = Files.newDirectoryStream(subDir)) {
                    for (Path file : files) {
                        if (Files.isRegularFile(file)) {
                            transactionTemplate.execute(status -> {
                                syncFileToDb(file, ownerType, ownerKey);
                                return null;
                            });
                        }
                    }
                }
            }
        } catch (IOException e) {
            log.error("Error syncing directory {}", baseDir, e);
        }
    }

    private void syncFileToDb(Path filePath, OwnerType ownerType, String ownerKey) {
        String absolutePath = filePath.toAbsolutePath().toString();
        if (fileItemRepository.existsByFilePath(absolutePath)) return;

        Integer ownerId = resolveOwnerId(ownerType, ownerKey);
        if (ownerId == null) return;

        String fileName = filePath.getFileName().toString();
        FileItem fileItem = FileItem.builder()
                .originalFileName(fileName)
                .storedFileName(fileName)
                .filePath(absolutePath)
                .fileSize(getFileSize(filePath))
                .ownerType(ownerType)
                .ownerId(ownerId)
                .build();
        FileItem saved = fileItemRepository.save(fileItem);

        if (isPdf(fileName)) {
            createDocumentFromFile(saved, ownerType, ownerId);
        }
        log.info("[WatchService] Synced: {} → {} {}", fileName, ownerType, ownerKey);
    }

    // ── WatchService 루프 ──────────────────────────────────────────────────

    private void startWatcher() {
        try {
            watcher = FileSystems.getDefault().newWatchService();
            registerDirectory(Paths.get(uploadDir, "Scopes"));
            registerDirectory(Paths.get(uploadDir, "Users"));
            scopeRepository.findAll().forEach(s ->
                    registerDirectory(Paths.get(uploadDir, "Scopes", s.getScopeCode())));
            userRepository.findAll().forEach(u ->
                    registerDirectory(Paths.get(uploadDir, "Users", u.getEmpNo())));

            watchThread = new Thread(this::watchLoop, "file-watcher");
            watchThread.setDaemon(true);
            watchThread.start();
            log.info("[WatchService] Started watching {}", uploadDir);
        } catch (IOException e) {
            log.error("[WatchService] Failed to start", e);
        }
    }

    private void watchLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            WatchKey key;
            try {
                key = watcher.take();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (ClosedWatchServiceException e) {
                break;
            }

            Path dir = keyToPath.get(key);
            if (dir == null) { key.reset(); continue; }

            for (WatchEvent<?> event : key.pollEvents()) {
                WatchEvent.Kind<?> kind = event.kind();
                if (kind == OVERFLOW) continue;

                @SuppressWarnings("unchecked")
                Path filename = ((WatchEvent<Path>) event).context();
                Path fullPath = dir.resolve(filename);

                if (kind == ENTRY_CREATE) {
                    if (Files.isDirectory(fullPath)) {
                        registerDirectory(fullPath);
                    } else {
                        handleCreate(dir, fullPath);
                    }
                } else if (kind == ENTRY_DELETE) {
                    handleDelete(fullPath);
                }
            }
            key.reset();
        }
    }

    private void handleCreate(Path dir, Path fullPath) {
        String[] parts = resolveOwnerFromPath(dir);
        if (parts == null) return;
        OwnerType ownerType = OwnerType.valueOf(parts[0]);
        String ownerKey = parts[1];

        transactionTemplate.execute(status -> {
            syncFileToDb(fullPath, ownerType, ownerKey);
            return null;
        });
    }

    private void handleDelete(Path fullPath) {
        String absolutePath = fullPath.toAbsolutePath().toString();
        transactionTemplate.execute(status -> {
            fileItemRepository.findByFilePath(absolutePath).ifPresent(fileItem -> {
                documentRepository.deleteByFile(fileItem);
                fileItemRepository.delete(fileItem);
                log.info("[WatchService] Deleted: {}", absolutePath);
            });
            return null;
        });
    }

    // ── 헬퍼 메서드 ───────────────────────────────────────────────────────

    private String[] resolveOwnerFromPath(Path dir) {
        Path scopesBase = Paths.get(uploadDir, "Scopes").toAbsolutePath();
        Path usersBase  = Paths.get(uploadDir, "Users").toAbsolutePath();
        Path absDir     = dir.toAbsolutePath();

        if (absDir.startsWith(scopesBase) && absDir.getNameCount() > scopesBase.getNameCount()) {
            return new String[]{"SCOPE", absDir.getFileName().toString()};
        }
        if (absDir.startsWith(usersBase) && absDir.getNameCount() > usersBase.getNameCount()) {
            return new String[]{"USER", absDir.getFileName().toString()};
        }
        return null;
    }

    private Integer resolveOwnerId(OwnerType ownerType, String ownerKey) {
        if (ownerType == OwnerType.SCOPE) {
            return scopeRepository.findByScopeCode(ownerKey)
                    .map(Scope::getScopeId).orElse(null);
        } else {
            return userRepository.findByEmpNo(ownerKey)
                    .map(User::getUserId).orElse(null);
        }
    }

    private void createDocumentFromFile(FileItem fileItem, OwnerType ownerType, Integer ownerId) {
        if (documentRepository.existsByFile(fileItem)) return;

        Scope scope = null;
        User owner = null;

        if (ownerType == OwnerType.SCOPE) {
            scope = scopeRepository.findById(ownerId).orElse(null);
        } else {
            owner = userRepository.findById(ownerId).orElse(null);
        }

        DocumentEntity doc = DocumentEntity.builder()
                .title(fileItem.getOriginalFileName())
                .file(fileItem)
                .owner(owner)
                .scope(scope)
                .status(DocumentStatus.DRAFT)
                .originalContent("")
                .build();
        documentRepository.save(doc);
    }

    private void registerDirectory(Path path) {
        if (!Files.exists(path)) return;
        try {
            WatchKey key = path.register(watcher, ENTRY_CREATE, ENTRY_DELETE, ENTRY_MODIFY);
            keyToPath.put(key, path);
        } catch (IOException | NullPointerException e) {
            log.warn("[WatchService] Cannot register: {}", path);
        }
    }

    private void createDir(Path path) {
        try {
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                log.info("[WatchService] Created dir: {}", path);
            }
        } catch (IOException e) {
            log.error("[WatchService] Failed to create dir: {}", path, e);
        }
    }

    private boolean isPdf(String fileName) {
        return fileName != null && fileName.toLowerCase().endsWith(".pdf");
    }

    private long getFileSize(Path path) {
        try { return Files.size(path); } catch (IOException e) { return 0; }
    }

    @PreDestroy
    public void destroy() {
        if (watcher != null) try { watcher.close(); } catch (IOException e) { /* ignore */ }
        if (watchThread != null) watchThread.interrupt();
        log.info("[WatchService] Stopped");
    }
}
