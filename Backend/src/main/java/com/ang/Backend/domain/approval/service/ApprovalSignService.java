package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.approval.dto.ApprovalSignDto;
import com.ang.Backend.domain.approval.entity.UserSignature;
import com.ang.Backend.domain.approval.repository.UserSignatureRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalSignService {

    private final S3Client s3Client;
    private final UserSignatureRepository userSignatureRepository;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${spring.cloud.aws.region.static}")
    private String region;

    public List<ApprovalSignDto.Response> listSigns(User user) {
        return userSignatureRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(ApprovalSignDto.Response::from).collect(Collectors.toList());
    }

    @Transactional
    public ApprovalSignDto.Response uploadSign(MultipartFile file, String label, User user) {
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new CustomException(ErrorCode.INVALID_FILE_TYPE);
        }

        String key = "e-approval/signs/" + user.getUserId() + "/" + UUID.randomUUID() + "." + resolveExtension(contentType);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket).key(key).contentType(contentType).build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String url = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
        UserSignature sig = UserSignature.builder()
                .user(user).imageUrl(url)
                .label(label != null && !label.isBlank() ? label : file.getOriginalFilename())
                .build();
        return ApprovalSignDto.Response.from(userSignatureRepository.save(sig));
    }

    @Transactional
    public void deleteSign(Long signId, User user) {
        UserSignature sig = userSignatureRepository.findByIdAndUser(signId, user)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_SIGN_NOT_FOUND));
        deleteFromS3(sig.getImageUrl());
        userSignatureRepository.delete(sig);
    }

    public ApprovalSignDto.ImageData downloadSign(Long signId, User user) {
        UserSignature sig = userSignatureRepository.findByIdAndUser(signId, user)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_SIGN_NOT_FOUND));
        String url = sig.getImageUrl();
        String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
        byte[] data = s3Client.getObject(
                GetObjectRequest.builder().bucket(bucket).key(key).build(),
                ResponseTransformer.toBytes()
        ).asByteArray();
        return new ApprovalSignDto.ImageData(data, resolveContentType(key));
    }

    private void deleteFromS3(String url) {
        String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception e) {
            log.error("S3 서명 파일 삭제 실패: url={}, error={}", url, e.getMessage());
            throw new CustomException(ErrorCode.FILE_DELETE_FAILED);
        }
    }

    private String resolveExtension(String contentType) {
        return switch (contentType) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
            default -> contentType.substring("image/".length());
        };
    }

    private String resolveContentType(String key) {
        String ext = key.substring(key.lastIndexOf('.') + 1).toLowerCase();
        return switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            default -> "image/" + ext;
        };
    }
}
