package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.entity.ApprovalLine;
import com.ang.Backend.domain.approval.event.ApprovalCompletedEvent;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import com.ang.Backend.domain.approval.repository.ApprovalLineRepository;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalPdfService {

    private final ApprovalDocRepository docRepository;
    private final ApprovalLineRepository lineRepository;
    private final TemplateEngine templateEngine;
    private final S3Client s3Client;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${spring.cloud.aws.region.static}")
    private String region;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onApprovalCompleted(ApprovalCompletedEvent event) {
        Long docId = event.getDocId();
        try {
            ApprovalDoc doc = docRepository.findById(docId).orElse(null);
            if (doc == null) {
                log.warn("PDF 생성 실패: 문서를 찾을 수 없습니다. docId={}", docId);
                return;
            }

            List<ApprovalLine> approvedLines = lineRepository.findByDocAndStatus(doc, ApprovalLineStatus.APPROVED);

            List<ApprovalLine> commentLines = doc.getApprovalLines().stream()
                    .filter(l -> l.getComment() != null && !l.getComment().isBlank())
                    .sorted(Comparator.comparing(ApprovalLine::getProcessedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());

            // 서명 이미지를 S3(비공개)에서 직접 받아 base64 data URI로 변환
            // → openhtmltopdf가 공개 URL 접근(403) 없이 렌더링 가능
            Map<Long, String> signatureDataUris = new HashMap<>();
            for (ApprovalLine line : approvedLines) {
                String dataUri = toDataUri(line.getSignatureSnapshot());
                if (dataUri != null) {
                    signatureDataUris.put(line.getId(), dataUri);
                }
            }

            // formData JSON에서 content만 추출
            String docContent = "";
            try {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode node = mapper.readTree(doc.getFormData());
                docContent = node.path("content").asText("");
            } catch (Exception e) {
                docContent = doc.getFormData() != null ? doc.getFormData() : "";
            }

            // Thymeleaf 렌더링
            Context ctx = new Context();
            ctx.setVariable("doc", doc);
            ctx.setVariable("docContent", docContent);
            ctx.setVariable("approvalLines", approvedLines);
            ctx.setVariable("commentLines", commentLines);
            ctx.setVariable("signatureDataUris", signatureDataUris);
            ctx.setVariable("attachmentFilename", doc.getAttachmentName());
            String html = templateEngine.process("approval/approval-document", ctx);

            // HTML → PDF
            byte[] pdfBytes = renderPdf(html);

            // S3 업로드
            String key = "e-approval/pdf/" + docId + "/" + UUID.randomUUID() + ".pdf";
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType("application/pdf")
                            .build(),
                    RequestBody.fromBytes(pdfBytes)
            );

            String pdfUrl = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
            doc.setFinalPdfUrl(pdfUrl);
            docRepository.save(doc);

            log.info("PDF 생성 완료: docId={}, pdfBytes={}, 서명변환={}/{}건, url={}",
                    docId, pdfBytes.length, signatureDataUris.size(), approvedLines.size(), pdfUrl);
        } catch (Exception e) {
            log.error("PDF 생성 실패: docId={}", docId, e);
        }
    }

    // S3 비공개 객체 URL → base64 data URI (PDF 렌더 시 네트워크 접근 없이 이미지 삽입용)
    private String toDataUri(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
            ResponseBytes<GetObjectResponse> obj = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build());
            String contentType = obj.response().contentType();
            if (contentType == null || contentType.isBlank()) contentType = "image/png";
            String base64 = Base64.getEncoder().encodeToString(obj.asByteArray());
            return "data:" + contentType + ";base64," + base64;
        } catch (Exception e) {
            log.warn("서명 이미지 변환 실패: url={}, error={}", url, e.getMessage());
            return null;
        }
    }

    private byte[] renderPdf(String html) throws Exception {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(html, null);
            // 한글 폰트 설정
            builder.useFont(
                    () -> getClass().getResourceAsStream("/fonts/NanumGothic.ttf"),
                    "NanumGothic"
            );
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        }
    }
}
