package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.approval.dto.ApprovalSignDto;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalSignService {

    private final S3Client s3Client;
    private final UserRepository userRepository;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${spring.cloud.aws.region.static}")
    private String region;

    public ApprovalSignDto.Response getSign(User user) {
        if (user.getSignatureImageUrl() == null) {
            throw new CustomException(ErrorCode.APPROVAL_SIGN_NOT_FOUND);
        }
        return ApprovalSignDto.Response.builder()
                .signatureImageUrl(user.getSignatureImageUrl())
                .build();
    }

    @Transactional
    public ApprovalSignDto.Response uploadSign(MultipartFile file, User user) {
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new CustomException(ErrorCode.INVALID_FILE_TYPE);
        }

        // 기존 서명 삭제
        if (user.getSignatureImageUrl() != null) {
            deleteFromS3(user.getSignatureImageUrl());
        }

        String key = "e-approval/signs/" + user.getUserId() + "/" + UUID.randomUUID() + ".png";
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String url = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
        user.setSignatureImageUrl(url);
        userRepository.save(user);

        return ApprovalSignDto.Response.builder().signatureImageUrl(url).build();
    }

    @Transactional
    public void deleteSign(User user) {
        if (user.getSignatureImageUrl() == null) {
            throw new CustomException(ErrorCode.APPROVAL_SIGN_NOT_FOUND);
        }
        deleteFromS3(user.getSignatureImageUrl());
        user.setSignatureImageUrl(null);
        userRepository.save(user);
    }

    private void deleteFromS3(String url) {
        try {
            String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception e) {
            log.warn("S3 서명 파일 삭제 실패: url={}, error={}", url, e.getMessage());
        }
    }
}
