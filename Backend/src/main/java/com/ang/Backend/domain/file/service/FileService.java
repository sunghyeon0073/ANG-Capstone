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

/**
 * 파일 업로드, 다운로드, 동기화 및 물리적 파일 관리를 담당하는 서비스 클래스입니다.
 * 
 * [주요 개념 설명]
 * 1. 물리적 파일: 서버 하드디스크(uploads 폴더)에 실제로 저장된 실물 데이터
 * 2. 파일 메타데이터: DB(file_items 테이블)에 저장된 파일의 정보 (이름, 경로, 크기 등)
 * 
 * @Slf4j: 로깅을 위한 Lombok 어노테이션 (log.info, log.error 등을 사용 가능)
 * @Service: 스프링이 이 클래스를 비즈니스 로직을 처리하는 '서비스 빈'으로 관리하게 함
 * @RequiredArgsConstructor: final이 붙은 필드를 생성자 주입(DI) 방식으로 자동으로 채워줌
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileItemRepository fileItemRepository;
    private final UserRepository userRepository;

    // application.yml 또는 환경변수에서 설정된 파일 저장 기본 경로를 가져옴 (기본값: uploads)
    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    /**
     * [서버 시작 시 실행되는 파일 동기화 로직]
     * @PostConstruct: 의존성 주입이 완료된 후, 서비스가 가동되기 직전에 딱 한 번 실행됨
     * 서버 내 uploads 폴더에 있는 PDF 파일들을 읽어서 DB에 정보가 없으면 자동으로 등록해줌
     */
    @PostConstruct
    @Transactional
    public void syncPdfFilesFromUploadsDir() {
        File directory = new File(uploadDir);
        if (!directory.exists()) {
            directory.mkdirs(); // 저장 폴더가 없으면 자동 생성
            return;
        }

        // 폴더 내의 .pdf 파일만 필터링해서 가져옴
        File[] files = directory.listFiles((dir, name) -> name.toLowerCase().endsWith(".pdf"));
        if (files == null) return;

        for (File file : files) {
            String filePath = file.getAbsolutePath();
            // DB에 해당 경로의 파일 정보가 이미 있는지 중복 체크
            boolean exists = fileItemRepository.existsByFilePath(filePath);
            if (!exists) {
                // 실물 파일 정보를 바탕으로 DB 엔티티(Meta Data) 생성
                FileItem fileItem = FileItem.builder()
                        .originalFileName(file.getName())
                        .storedFileName(file.getName())
                        .filePath(filePath)
                        .fileSize(file.length())
                        .ownerType(OwnerType.USER)
                        .build();
                fileItemRepository.save(fileItem);
                log.info("새로운 PDF 파일을 DB와 동기화했습니다: {}", file.getName());
            }
        }
    }

    /**
     * [핵심 로직: 파일 업로드]
     * 사용자가 보낸 파일을 서버에 저장하고 DB에 기록하는 전체 과정을 제어합니다.
     * 
     * [데이터 흐름]
     * 1. 프론트엔드: MultipartFile 형식으로 파일 전송
     * 2. 경로 결정: 업로더의 사번 등을 이용해 개인별/부서별 격리된 폴더 경로 생성
     * 3. 파일 저장: UUID를 붙여 중복되지 않는 이름으로 서버 하드디스크에 물리적으로 저장
     * 4. DB 기록: 나중에 파일을 찾을 수 있도록 원본명, 저장명, 절대경로 등을 기록
     */
    @Transactional
    public FileDto uploadFile(MultipartFile file, Integer uploaderId, OwnerType ownerType, Integer ownerId) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("업로드할 파일이 비어있습니다.");
        }

        // 업로더(사용자) 정보 조회
        User uploader = userRepository.findById(uploaderId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 저장될 부모 디렉토리 경로 구성
        String customPath = uploadDir;
        if (ownerType == OwnerType.USER) {
            // 사용자별로 독립된 폴더 구성 (예: uploads/Users/2401028)
            customPath += File.separator + "Users" + File.separator + uploader.getEmpNo();
        } else if (ownerType == OwnerType.SCOPE) {
            // 부서별로 독립된 폴더 구성 (필요 시 확장)
        }

        // 실제 물리적 폴더가 없으면 생성 (상위 폴더까지 한꺼번에 생성)
        File directory = new File(customPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        // 파일명 중복 방지를 위한 UUID 처리
        String originalFilename = file.getOriginalFilename();
        String storedFileName = UUID.randomUUID().toString() + "_" + originalFilename;
        String filePath = customPath + File.separator + storedFileName;

        // 1. 실물 파일을 지정된 경로에 물리적으로 복사 (가장 중요한 단계)
        file.transferTo(new File(filePath));

        // 2. 파일의 메타데이터(정보)를 DB에 저장
        FileItem fileItem = FileItem.builder()
                .originalFileName(originalFilename) // 사용자가 본인의 컴퓨터에서 보던 파일 이름
                .storedFileName(storedFileName)     // 서버 내부적으로 관리하는 고유 이름
                .filePath(filePath)                 // 파일의 전체 절대 경로
                .fileSize(file.getSize())           // 파일 용량 (Byte 단위)
                .ownerType(ownerType)
                .ownerId(ownerId)
                .uploader(uploader)
                .build();

        // 저장된 정보를 DTO로 변환하여 반환
        return FileDto.from(fileItemRepository.save(fileItem));
    }

    /**
     * 특정 소유자(사용자 또는 부서)에게 속한 파일 목록을 조회합니다.
     */
    @Transactional(readOnly = true)
    public List<FileDto> getFilesByOwner(OwnerType ownerType, Integer ownerId) {
        return fileItemRepository.findByOwnerTypeAndOwnerId(ownerType, ownerId).stream()
                .map(FileDto::from)
                .collect(Collectors.toList());
    }

    /**
     * [범용 파일 저장 헬퍼 메소드]
     * 다른 서비스(예: 전자결재, 게시판)에서 파일을 저장할 때 공통으로 호출하여 사용합니다.
     */
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

        // 물리적 저장 실행
        file.transferTo(new File(filePath));

        // DB 기록 및 결과 반환
        return fileItemRepository.save(FileItem.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .fileSize(file.getSize())
                .uploader(uploader)
                .ownerId(uploader != null ? uploader.getUserId() : null)
                .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                .build());
    }

    /**
     * 파일 삭제 로직 (물리적 파일 + DB 기록 모두 삭제)
     */
    @Transactional
    public void deletePhysicalFile(FileItem fileItem) {
        File file = new File(fileItem.getFilePath());
        if (file.exists()) {
            file.delete(); // 하드디스크에서 실물 삭제
        }
        fileItemRepository.delete(fileItem); // DB에서 정보 삭제
    }
    
    /**
     * [파일 다운로드 로직]
     * DB의 파일 경로를 바탕으로 실제 리소스를 읽어와서 스트림 형태로 반환합니다.
     */
    @Transactional(readOnly = true)
    public Resource loadFileAsResource(Long fileId) {
        try {
            // 1. DB에서 파일 정보 조회
            FileItem fileItem = fileItemRepository.findById(fileId)
                    .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
            
            // 2. 경로 분석 및 리소스화
            Path filePath = Paths.get(fileItem.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            
            // 3. 파일 존재 여부 최종 확인 후 반환
            if (resource.exists()) {
                return resource;
            } else {
                throw new CustomException(ErrorCode.NOT_FOUND);
            }
        } catch (Exception ex) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }
    
    /**
     * 파일의 상세 메타데이터 정보를 조회합니다.
     */
    @Transactional(readOnly = true)
    public FileItem getFileItem(Long fileId) {
        return fileItemRepository.findById(fileId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }
}
