package com.ang.Backend.domain.file.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3FileService {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public String upload(MultipartFile file) {
        return upload(file, List.of());
    }

    public String uploadForPerson(MultipartFile file, String empNo) {
        if (empNo == null || empNo.isBlank()) {
            return upload(file);
        }

        return upload(file, List.of("person/" + sanitizePrefixPart(empNo)));
    }

    private String upload(MultipartFile file, List<String> mirrorPrefixes) {
        String originalName = file.getOriginalFilename();
        String ext = "";

        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }

        String objectPath = LocalDate.now() + "/" + UUID.randomUUID() + ext;
        String key = "uploads/" + objectPath;

        try {
            putObject(file, key);

            for (String prefix : mirrorPrefixes) {
                putObject(file, normalizePrefix(prefix) + "/" + objectPath);
            }

            return key;
        } catch (IOException e) {
            throw new RuntimeException("S3 ?낅줈???ㅽ뙣", e);
        }
    }

    private void putObject(MultipartFile file, String key) throws IOException {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(
                request,
                RequestBody.fromInputStream(file.getInputStream(), file.getSize())
        );
    }

    public byte[] download(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        return s3Client.getObjectAsBytes(request).asByteArray();
    }

    public void delete(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        s3Client.deleteObject(request);
    }

    public boolean exists(String key) {
        try {
            HeadObjectRequest request = HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            s3Client.headObject(request);
            return true;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
    }

    private String normalizePrefix(String prefix) {
        return prefix.replaceAll("^/+", "").replaceAll("/+$", "");
    }

    private String sanitizePrefixPart(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
