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
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileWatcherService {

    private final FileItemRepository fileItemRepository;
    private final DocumentRepository documentRepository;
    private final ScopeRepository scopeRepository;
    private final UserRepository userRepository;

    @Value("${file.upload.dir:/app/uploads}")
    private String uploadDir;

    @Value("${file.watcher.enabled:false}")
    private boolean watcherEnabled;

    private WatchService watchService;
    private ExecutorService executor;
    private Map<WatchKey, Path> keys;

    @PostConstruct
    public void init() {
        if (!watcherEnabled) {
            log.info("File Watcher disabled because files are stored in S3");
            return;
        }

        try {
            watchService = FileSystems.getDefault().newWatchService();
            keys = new HashMap<>();

            Path rootPath = Paths.get(uploadDir);
            ensureDirectoryExists(rootPath);
            ensureDirectoryExists(rootPath.resolve("Scopes"));
            ensureDirectoryExists(rootPath.resolve("Users"));

            syncExistingFolders(rootPath);
            registerAll(rootPath);

            executor = Executors.newSingleThreadExecutor();
            executor.submit(this::processEvents);
            log.info("File Watcher started for directory: {}", uploadDir);

        } catch (IOException e) {
            log.error("Failed to initialize FileWatcherService", e);
        }
    }

    private void syncExistingFolders(Path rootPath) {
        scopeRepository.findAll().forEach(scope -> {
            try {
                ensureDirectoryExists(rootPath.resolve("Scopes").resolve(scope.getScopeCode()));
            } catch (IOException e) {
                log.error("Failed to create folder for existing scope: {}", scope.getScopeCode());
            }
        });

        userRepository.findAll().forEach(user -> {
            try {
                ensureDirectoryExists(rootPath.resolve("Users").resolve(user.getEmpNo()));
            } catch (IOException e) {
                log.error("Failed to create folder for existing user: {}", user.getEmpNo());
            }
        });
    }

    private void ensureDirectoryExists(Path path) throws IOException {
        if (!Files.exists(path)) {
            Files.createDirectories(path);
            log.info("Created directory: {}", path);
        }
    }

    private void registerAll(final Path start) throws IOException {
        Files.walkFileTree(start, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                register(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void register(Path dir) throws IOException {
        WatchKey key = dir.register(watchService, 
            StandardWatchEventKinds.ENTRY_CREATE, 
            StandardWatchEventKinds.ENTRY_DELETE);
        keys.put(key, dir);
        log.info("Registered directory for watch: {}", dir);
    }

    private void processEvents() {
        while (true) {
            WatchKey key;
            try {
                key = watchService.take();
            } catch (InterruptedException x) {
                return;
            }

            Path dir = keys.get(key);
            if (dir == null) continue;

            for (WatchEvent<?> event : key.pollEvents()) {
                WatchEvent.Kind<?> kind = event.kind();
                if (kind == StandardWatchEventKinds.OVERFLOW) continue;

                @SuppressWarnings("unchecked")
                WatchEvent<Path> ev = (WatchEvent<Path>) event;
                Path name = ev.context();
                Path child = dir.resolve(name);

                try {
                    if (kind == StandardWatchEventKinds.ENTRY_CREATE) {
                        if (Files.isDirectory(child, LinkOption.NOFOLLOW_LINKS)) {
                            registerAll(child);
                        } else {
                            Thread.sleep(1000);
                            processNewFile(child.toFile(), dir);
                        }
                    } else if (kind == StandardWatchEventKinds.ENTRY_DELETE) {
                        processDeletedFile(child.toAbsolutePath().toString());
                    }
                } catch (IOException | InterruptedException x) {
                    log.error("Error processing file event", x);
                }
            }

            if (!key.reset()) {
                keys.remove(key);
                if (keys.isEmpty()) break;
            }
        }
    }

    @Transactional
    public void processNewFile(File file, Path parentDir) {
        String fileName = file.getName();
        if (!fileName.toLowerCase().endsWith(".pdf")) return;

        String filePath = file.getAbsolutePath();
        if (fileItemRepository.existsByFilePath(filePath)) return;

        log.info("New PDF file detected: {}", filePath);

        Path rootPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path currentParentPath = parentDir.toAbsolutePath().normalize();
        Path relativePath = rootPath.relativize(currentParentPath);

        if (relativePath.getNameCount() < 2) {
            registerUnclassified(file, filePath, fileName);
            return;
        }

        String topFolder = relativePath.getName(0).toString();
        String identifier = relativePath.getName(1).toString();

        if ("Scopes".equalsIgnoreCase(topFolder)) {
            handleScopeFile(file, filePath, fileName, identifier);
        } else if ("Users".equalsIgnoreCase(topFolder)) {
            handleUserFile(file, filePath, fileName, identifier);
        } else {
            registerUnclassified(file, filePath, fileName);
        }
    }

    @Transactional
    public void processDeletedFile(String absolutePath) {
        Optional<FileItem> fileItemOpt = fileItemRepository.findByFilePath(absolutePath);
        if (fileItemOpt.isPresent()) {
            FileItem item = fileItemOpt.get();
            log.info("Physical file deleted, cleaning up DB for: {}", absolutePath);
            
            // 관련 문서 삭제 (Soft Delete 원하시면 상태만 변경하도록 수정 가능)
            documentRepository.deleteByFile(item);
            fileItemRepository.delete(item);
        }
    }

    private void handleScopeFile(File file, String filePath, String fileName, String scopeCode) {
        Scope scope = scopeRepository.findByScopeCode(scopeCode).orElse(null);
        if (scope == null) {
            registerUnclassified(file, filePath, fileName);
            return;
        }
        FileItem item = saveFileItem(file, filePath, fileName, OwnerType.SCOPE, scope.getScopeId(), null);
        saveDocument(item, fileName, scope, null);
    }

    private void handleUserFile(File file, String filePath, String fileName, String empNo) {
        User user = userRepository.findByEmpNo(empNo).orElse(null);
        if (user == null) {
            registerUnclassified(file, filePath, fileName);
            return;
        }
        FileItem item = saveFileItem(file, filePath, fileName, OwnerType.USER, user.getUserId(), user);
        saveDocument(item, fileName, null, user);
    }

    private void registerUnclassified(File file, String filePath, String fileName) {
        FileItem item = saveFileItem(file, filePath, fileName, OwnerType.USER, null, null);
        saveDocument(item, fileName, null, null);
    }

    private FileItem saveFileItem(File file, String filePath, String fileName, OwnerType type, Integer ownerId, User uploader) {
        return fileItemRepository.save(FileItem.builder()
                .originalFileName(fileName)
                .storedFileName(fileName)
                .filePath(filePath)
                .fileSize(file.length())
                .ownerType(type)
                .ownerId(ownerId)
                .uploader(uploader)
                .build());
    }

    private void saveDocument(FileItem item, String title, Scope scope, User owner) {
        if (!documentRepository.existsByFile(item)) {
            documentRepository.save(DocumentEntity.builder()
                    .title(title)
                    .file(item)
                    .status(DocumentStatus.DRAFT)
                    .originalContent("Sync from physical file: " + title)
                    .scope(scope)
                    .owner(owner)
                    .build());
            log.info("Auto-created Document: {} (Scope: {}, Owner: {})", title, 
                    scope != null ? scope.getScopeCode() : "N/A", 
                    owner != null ? owner.getEmpNo() : "N/A");
        }
    }

    @PreDestroy
    public void destroy() {
        if (executor != null) executor.shutdownNow();
        try {
            if (watchService != null) watchService.close();
        } catch (IOException e) {
            log.error("Error closing watch service", e);
        }
    }
}
