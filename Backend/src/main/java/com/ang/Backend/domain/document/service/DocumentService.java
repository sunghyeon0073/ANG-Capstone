package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.DTO.DocumentParseResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final String CONTAINER_UPLOAD_DIR = "/app/uploads";

    private final RestTemplate restTemplate;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${ai.base-url}")
    private String aiBaseUrl;

    public DocumentParseResponse saveAndParse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "document" : file.getOriginalFilename());
        String savedName = UUID.randomUUID() + "_" + originalName;

        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);

            Path savePath = dir.resolve(savedName).normalize();
            file.transferTo(savePath.toFile());
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String containerFilePath = CONTAINER_UPLOAD_DIR + "/" + savedName;
        Map<String, String> body = new HashMap<>();
        body.put("file_path", containerFilePath);

        String aiResponse = restTemplate.postForObject(
                aiBaseUrl + "/parse-document",
                body,
                String.class
        );

        return new DocumentParseResponse(savedName, containerFilePath, aiResponse);
    }
}
