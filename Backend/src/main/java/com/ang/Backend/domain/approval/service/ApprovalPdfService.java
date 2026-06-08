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
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayOutputStream;
import java.util.Comparator;
import java.util.List;
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

            // Thymeleaf 렌더링
            Context ctx = new Context();
            ctx.setVariable("doc", doc);
            ctx.setVariable("approvalLines", approvedLines);
            ctx.setVariable("commentLines", commentLines);
            ctx.setVariable("attachmentFilename", extractFilename(doc.getAttachmentUrl()));
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

            log.info("PDF 생성 완료: docId={}, url={}", docId, pdfUrl);
        } catch (Exception e) {
            log.error("PDF 생성 실패: docId={}", docId, e);
        }
    }

    private String extractFilename(String url) {
        if (url == null || url.isBlank()) return null;
        String lastSegment = url.substring(url.lastIndexOf('/') + 1);
        // e-approval/attachments/{docId}/{UUID}.확장자 구조에서 UUID 부분 제거
        int dotIdx = lastSegment.lastIndexOf('.');
        if (dotIdx > 0) {
            String ext = lastSegment.substring(dotIdx);        // .hwp, .docx 등
            String uuidPart = lastSegment.substring(0, dotIdx);
            // UUID 패턴(8-4-4-4-12) 이면 의미없는 이름이므로 확장자만 반환
            if (uuidPart.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
                return "첨부파일" + ext;
            }
        }
        return lastSegment;
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
