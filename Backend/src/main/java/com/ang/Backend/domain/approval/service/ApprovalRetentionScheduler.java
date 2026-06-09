package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalRetentionScheduler {

    private final ApprovalDocRepository docRepository;
    private final S3Client s3Client;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    private static final Pattern YEAR_PATTERN = Pattern.compile("(\\d+)\\s*년");

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void expireDocuments() {
        List<ApprovalDoc> docs = docRepository
                .findByStatusAndCompletedAtIsNotNull(ApprovalStatus.APPROVED);
        LocalDateTime now = LocalDateTime.now();

        for (ApprovalDoc doc : docs) {
            parseYears(doc.getRetentionPeriod()).ifPresent(years -> {
                if (now.isAfter(doc.getCompletedAt().plusYears(years))) {
                    deleteS3File(doc.getFinalPdfUrl());
                    deleteS3File(doc.getAttachmentUrl());
                    doc.setStatus(ApprovalStatus.EXPIRED);
                    doc.setFinalPdfUrl(null);
                    doc.setAttachmentUrl(null);
                    docRepository.save(doc);
                    log.info("문서 만료 처리: docId={}", doc.getId());
                }
            });
        }
    }

    private Optional<Integer> parseYears(String period) {
        if (period == null) return Optional.empty();
        Matcher m = YEAR_PATTERN.matcher(period);
        // "영구" 또는 인식 불가 포맷은 empty → 만료 처리 안 함
        return m.find() ? Optional.of(Integer.parseInt(m.group(1))) : Optional.empty();
    }

    private void deleteS3File(String url) {
        if (url == null || url.isBlank()) return;
        String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
        try {
            s3Client.deleteObject(b -> b.bucket(bucket).key(key));
        } catch (Exception e) {
            log.warn("S3 삭제 실패: key={}", key, e);
        }
    }
}
