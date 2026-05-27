package com.ang.Backend.domain.file.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3FileService {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public String upload(MultipartFile file) {
        return upload(file, "uploads/" + LocalDate.now());
    }

    public String upload(MultipartFile file, String folder) {
        String originalName = file.getOriginalFilename();

        String ext = "";

        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }

        String key = folder + "/" + UUID.randomUUID() + ext;

        try {
            PutObjectRequest request =
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType())
                            .build();

            s3Client.putObject(
                    request,
                    RequestBody.fromInputStream(
                            file.getInputStream(),
                            file.getSize()
                    )
            );

            return key;
        } catch (IOException e) {
            throw new com.ang.Backend.common.exception.CustomException(
                    com.ang.Backend.common.exception.ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    public byte[] download(String key) {
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            return s3Client.getObjectAsBytes(request).asByteArray();
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            throw new com.ang.Backend.common.exception.CustomException(
                    com.ang.Backend.common.exception.ErrorCode.FILE_NOT_FOUND);
        }
    }

    public void delete(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        s3Client.deleteObject(request);
    }

    public String uploadText(String content, String fileName) {
        String key = "documents/" + LocalDate.now() + "/" + UUID.randomUUID() + ".md";
        byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("text/markdown; charset=UTF-8")
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(bytes));
        return key;
    }

    public String uploadBytes(byte[] bytes, String fileName, String contentType, String prefix) {
        String ext = "";
        if (fileName != null && fileName.contains(".")) {
            ext = fileName.substring(fileName.lastIndexOf("."));
        }

        String key = prefix + "/" + LocalDate.now() + "/" + UUID.randomUUID() + ext;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(bytes));
        return key;
    }
}
