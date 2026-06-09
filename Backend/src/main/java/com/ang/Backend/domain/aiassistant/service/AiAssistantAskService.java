package com.ang.Backend.domain.aiassistant.service;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.aiassistant.dto.AiAssistantDto;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import com.ang.Backend.domain.mail.repository.MailRecipientRepository;
import com.ang.Backend.domain.mail.repository.MailRepository;
import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.repository.ScheduleRepository;
import com.ang.Backend.domain.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAssistantAskService {

    private final ScheduleRepository scheduleRepository;
    private final MailRepository mailRepository;
    private final MailRecipientRepository mailRecipientRepository;
    private final DocumentRepository documentRepository;
    private final FileItemRepository fileItemRepository;
    private final ApprovalDocRepository approvalDocRepository;
    private final AiScheduledActionService aiScheduledActionService;
    private final RestClient ollamaRestClient;
    private final ObjectMapper objectMapper;

    @Value("${ollama.secretary-model:ang-secretary:latest}")
    private String secretaryModel;

    private static final int MAX_RESULTS = 5;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("M월 d일");

    private record IntentResult(String intent, String keyword, String dateRange) {}

    // ===== Entry Point =====

    @Transactional
    public AiAssistantDto.AskResponse ask(String prompt, boolean confirm, User user) {
        String p = prompt == null ? "" : prompt.trim();

        // Obvious send intent: skip LLM classification (fast path)
        if (isSendIntentFast(p)) return handleScheduledSend(p, confirm, user);

        IntentResult ir = classify(p);
        log.debug("Secretary intent: {} keyword: {} dateRange: {}", ir.intent(), ir.keyword(), ir.dateRange());

        return switch (ir.intent()) {
            case "schedule_query"   -> handleScheduleQuery(p, ir, user);
            case "mail_search"      -> handleMailSearch(p, ir, user);
            case "document_search"  -> handleDocumentSearch(p, ir, user);
            case "file_search"      -> handleFileSearch(p, ir, user);
            case "approval_query"   -> handleApprovalQuery(p, user);
            case "scheduled_send"   -> handleScheduledSend(p, confirm, user);
            default                 -> unknownResponse();
        };
    }

    // ===== Intent Classification =====

    private IntentResult classify(String prompt) {
        // keyword matching first (instant) — only call LLM when it returns unknown
        IntentResult kw = classifyByKeyword(prompt);
        if (!"unknown".equals(kw.intent())) return kw;
        IntentResult llm = classifyWithLLM(prompt);
        return normalizeIntentResult(prompt, llm, kw);
    }

    private boolean isSendIntentFast(String p) {
        return containsAny(p, "보내줘", "전송해줘", "발송해줘", "예약해줘")
                && containsAny(p, "메일", "채팅", "메시지", "쪽지");
    }

    @SuppressWarnings("unchecked")
    private IntentResult classifyWithLLM(String prompt) {
        try {
            Map<String, Object> body = Map.of(
                    "model", secretaryModel,
                    "prompt", buildClassifyPrompt(prompt),
                    "stream", false,
                    "options", Map.of("temperature", 0.1, "num_predict", 120)
            );
            Map<String, Object> resp = ollamaRestClient.post()
                    .uri("/api/generate")
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (resp == null || resp.get("response") == null) return null;

            String raw = stripThinkTags(resp.get("response").toString());
            int start = raw.indexOf('{');
            int end = raw.lastIndexOf('}');
            if (start == -1 || end <= start) return null;

            Map<String, Object> parsed = objectMapper.readValue(raw.substring(start, end + 1), Map.class);
            String intent = parsed.get("intent") instanceof String s ? s.trim() : null;
            if (intent == null || intent.isBlank()) return null;

            String keyword  = toStringOrNull(parsed.get("keyword"));
            String dateRange = toStringOrNull(parsed.get("dateRange"));

            return new IntentResult(intent, keyword, dateRange);
        } catch (Exception e) {
            log.debug("LLM classification failed, using keyword fallback: {}", e.getMessage());
            return null;
        }
    }

    private String buildClassifyPrompt(String userInput) {
        return "너는 ANG 그룹웨어 비서의 의도 분석기입니다. 사용자 질문의 의미를 이해해서 JSON만 출력하세요. 설명 없이 JSON만 출력하세요.\n\n"
                + "인텐트 목록:\n"
                + "- schedule_query   : 일정/스케줄/캘린더/회의/미팅/약속 조회\n"
                + "- mail_search      : 메일/이메일/받은 것/보낸 것 검색\n"
                + "- document_search  : 문서/보고서/기획서/자료 검색\n"
                + "- file_search      : 파일/첨부파일 검색\n"
                + "- approval_query   : 결재/승인 대기 조회\n"
                + "- scheduled_send   : 메시지/메일/채팅 예약 또는 즉시 발송\n"
                + "- unknown          : 위에 해당 없음\n\n"
                + "규칙:\n"
                + "- 사용자가 '오늘 일정 뭐있냐', '오늘 뭐 있어', '내일 회의 있나'처럼 물으면 schedule_query입니다.\n"
                + "- '찾아', '찾아줘', '검색', '알려줘', '보여줘', '있어', '뭐야' 같은 동사/명령어는 keyword가 아닙니다.\n"
                + "- keyword는 사용자가 찾으려는 핵심 명사만 넣으세요. 예: '계약서 메일 찾아줘' -> 계약서\n"
                + "- 일정 질문에서 날짜 표현이 없으면 today로 둡니다.\n"
                + "- dateRange는 today, tomorrow, this_week, next_week, null 중 하나만 사용하세요.\n\n"
                + "JSON 형식:\n"
                + "{\"intent\":\"...\","
                + "\"keyword\":\"검색 키워드(없으면 null)\","
                + "\"dateRange\":\"today|tomorrow|this_week|next_week|null\"}\n\n"
                + "예시:\n"
                + "질문: 오늘 뭐 있어? -> {\"intent\":\"schedule_query\",\"keyword\":null,\"dateRange\":\"today\"}\n"
                + "질문: 오늘 일정 뭐있냐? -> {\"intent\":\"schedule_query\",\"keyword\":null,\"dateRange\":\"today\"}\n"
                + "질문: 내일 미팅 있어? -> {\"intent\":\"schedule_query\",\"keyword\":null,\"dateRange\":\"tomorrow\"}\n"
                + "질문: 회의 일정 알려줘 -> {\"intent\":\"schedule_query\",\"keyword\":\"회의\",\"dateRange\":\"today\"}\n"
                + "질문: 박부장님한테 온 거 있어? -> {\"intent\":\"mail_search\",\"keyword\":\"박부장\",\"dateRange\":null}\n"
                + "질문: 계약서 메일 찾아줘 -> {\"intent\":\"mail_search\",\"keyword\":\"계약서\",\"dateRange\":null}\n"
                + "질문: 결재 밀린 거 있어? -> {\"intent\":\"approval_query\",\"keyword\":null,\"dateRange\":null}\n"
                + "질문: 내가 쓴 기획서 뭐 있나 -> {\"intent\":\"document_search\",\"keyword\":\"기획서\",\"dateRange\":null}\n"
                + "질문: 회의자료 찾아봐 -> {\"intent\":\"document_search\",\"keyword\":\"회의자료\",\"dateRange\":null}\n\n"
                + "질문: " + userInput;
    }

    private IntentResult classifyByKeyword(String p) {
        if (containsAny(p, "결재", "결재함", "결재대기", "승인대기", "승인 대기", "결재 대기")) return new IntentResult("approval_query", null, null);
        if (containsAny(p, "일정", "스케줄", "캘린더", "회의", "미팅", "약속")) return new IntentResult("schedule_query", null, detectDateRange(p));
        if (containsAny(p, "메일", "이메일")) return new IntentResult("mail_search", null, null);
        if (containsAny(p, "문서", "보고서", "기획서", "계획서", "자료")) return new IntentResult("document_search", null, null);
        if (containsAny(p, "파일", "첨부")) return new IntentResult("file_search", null, null);
        if (containsAny(p, "오늘", "내일", "이번주", "이번 주", "다음주", "다음 주"))
            return new IntentResult("schedule_query", null, detectDateRange(p));
        return new IntentResult("unknown", null, null);
    }

    private IntentResult normalizeIntentResult(String prompt, IntentResult llm, IntentResult fallback) {
        if (llm == null) return fallback;

        String intent = normalizeIntent(llm.intent());
        if ("unknown".equals(intent) && fallback != null && !"unknown".equals(fallback.intent())) {
            intent = fallback.intent();
        }

        String dateRange = normalizeDateRange(llm.dateRange());
        if (dateRange == null && fallback != null && "schedule_query".equals(intent)) {
            dateRange = fallback.dateRange() != null ? fallback.dateRange() : detectDateRange(prompt);
        }
        if (dateRange == null && "schedule_query".equals(intent)) {
            dateRange = detectDateRange(prompt);
        }

        String keyword = normalizeKeyword(llm.keyword(), commonCommandWordsForIntent(intent));
        if (keyword == null && needsKeyword(intent)) {
            keyword = extractKeyword(prompt, commonCommandWordsForIntent(intent));
        }

        return new IntentResult(intent, keyword, dateRange);
    }

    private String normalizeIntent(String intent) {
        if (intent == null || intent.isBlank()) return "unknown";
        return switch (intent.trim()) {
            case "schedule_query", "mail_search", "document_search", "file_search", "approval_query", "scheduled_send" -> intent.trim();
            default -> "unknown";
        };
    }

    private String normalizeDateRange(String dateRange) {
        if (dateRange == null || dateRange.isBlank() || "null".equalsIgnoreCase(dateRange)) return null;
        return switch (dateRange.trim()) {
            case "today", "tomorrow", "this_week", "next_week" -> dateRange.trim();
            default -> null;
        };
    }

    private boolean needsKeyword(String intent) {
        return "mail_search".equals(intent) || "document_search".equals(intent) || "file_search".equals(intent);
    }

    private String[] commonCommandWordsForIntent(String intent) {
        return switch (intent) {
            case "mail_search" -> new String[]{"메일", "이메일", "찾아줘", "찾아", "찾아봐", "검색", "검색해줘", "알려줘", "보여줘", "보낸", "받은", "최근", "있어", "있냐", "뭐야"};
            case "document_search" -> new String[]{"문서", "보고서", "기획서", "계획서", "자료", "찾아줘", "찾아", "찾아봐", "검색", "검색해줘", "알려줘", "보여줘", "관련", "최근", "있어", "있냐", "뭐야"};
            case "file_search" -> new String[]{"파일", "첨부", "첨부파일", "찾아줘", "찾아", "찾아봐", "검색", "검색해줘", "알려줘", "보여줘", "관련", "최근", "있어", "있냐", "뭐야"};
            default -> new String[]{"찾아줘", "찾아", "찾아봐", "검색", "검색해줘", "알려줘", "보여줘", "뭐야", "있어", "있냐", "최근"};
        };
    }

    private String detectDateRange(String p) {
        if (containsAny(p, "다음주", "다음 주")) return "next_week";
        if (containsAny(p, "이번주", "이번 주")) return "this_week";
        if (containsAny(p, "내일")) return "tomorrow";
        return "today";
    }

    // ===== Handlers =====

    private AiAssistantDto.AskResponse handleScheduleQuery(String prompt, IntentResult ir, User user) {
        LocalDate today = LocalDate.now();
        LocalDate from, to;
        String label;
        String dr = ir.dateRange() != null ? ir.dateRange() : "today";

        switch (dr) {
            case "next_week" -> { from = today.with(DayOfWeek.MONDAY).plusWeeks(1); to = from.with(DayOfWeek.SUNDAY); label = "다음 주"; }
            case "this_week" -> { from = today.with(DayOfWeek.MONDAY); to = today.with(DayOfWeek.SUNDAY); label = "이번 주"; }
            case "tomorrow"  -> { from = to = today.plusDays(1); label = "내일"; }
            default          -> { from = to = today; label = "오늘"; }
        }

        List<Schedule> all = scheduleRepository.findByOwnerAndDateRange(user, from, to);
        List<AiAssistantDto.ResultItem> results = all.stream().limit(MAX_RESULTS)
                .map(s -> AiAssistantDto.ResultItem.builder()
                        .type("schedule").title(s.getTitle())
                        .summary(s.getStartDate().format(DATE_FMT) + " " + s.getStartTime() + "~" + s.getEndTime()
                                + (s.getDescription() != null && !s.getDescription().isBlank()
                                        ? " · " + truncate(s.getDescription(), 40) : ""))
                        .date(s.getStartDate().toString()).targetId(s.getScheduleId())
                        .route("calendar").sourceLabel("내 캘린더").build())
                .toList();

        String fallback = results.isEmpty()
                ? label + " 등록된 일정이 없어요."
                : label + " 일정이 총 " + all.size() + "개예요.";

        return AiAssistantDto.AskResponse.builder()
                .answer(enrichAnswerWithLLM(prompt, buildScheduleContext(label, all), fallback))
                .intent("schedule_query").results(results)
                .actions(List.of(makeNavAction("캘린더 바로가기", "calendar")))
                .missingFields(List.of()).hasMore(all.size() > MAX_RESULTS).build();
    }

    private AiAssistantDto.AskResponse handleMailSearch(String prompt, IntentResult ir, User user) {
        String keyword = resolveSearchKeyword(prompt, ir.keyword(),
                "메일", "이메일", "찾아줘", "찾아", "검색", "검색해줘", "보낸", "받은", "최근", "있어", "있냐", "뭐야");
        PageRequest page = PageRequest.of(0, MAX_RESULTS);

        List<MailRecipient> received = mailRecipientRepository.searchReceivedByKeyword(user, keyword, page);
        List<Mail> sent = mailRepository.searchSentByKeyword(user, keyword, List.of(MailStatus.SENT), page);

        List<AiAssistantDto.ResultItem> results = new ArrayList<>();
        received.forEach(mr -> results.add(AiAssistantDto.ResultItem.builder()
                .type("mail").title(mr.getMail().getTitle())
                .summary("발신: " + mr.getMail().getSender().getName()
                        + (mr.getMail().getSentAt() != null
                                ? " · " + mr.getMail().getSentAt().toLocalDate().format(DATE_FMT) : ""))
                .date(mr.getMail().getSentAt() != null ? mr.getMail().getSentAt().toString() : "")
                .targetId(mr.getMail().getMailId()).route("mail").sourceLabel("수신함").build()));

        int remaining = MAX_RESULTS - results.size();
        if (remaining > 0) {
            sent.stream().limit(remaining).forEach(m -> results.add(AiAssistantDto.ResultItem.builder()
                    .type("mail").title(m.getTitle())
                    .summary("내가 보낸 메일" + (m.getSentAt() != null
                            ? " · " + m.getSentAt().toLocalDate().format(DATE_FMT) : ""))
                    .date(m.getSentAt() != null ? m.getSentAt().toString() : "")
                    .targetId(m.getMailId()).route("mail").sourceLabel("발신함").build()));
        }

        String fallback = results.isEmpty()
                ? (keyword != null ? "\"" + keyword + "\" 관련 메일을 찾지 못했어요." : "최근 메일이 없어요.")
                : (keyword != null ? "\"" + keyword + "\" 관련 메일 " + results.size() + "건을 찾았어요."
                        : "최근 메일 " + results.size() + "건이에요.");

        return AiAssistantDto.AskResponse.builder()
                .answer(enrichAnswerWithLLM(prompt, buildMailContext(keyword, results), fallback))
                .intent("mail_search").results(results)
                .actions(List.of(makeNavAction("메일함 바로가기", "mail")))
                .missingFields(List.of()).hasMore(false).build();
    }

    private AiAssistantDto.AskResponse handleDocumentSearch(String prompt, IntentResult ir, User user) {
        String keyword = resolveSearchKeyword(prompt, ir.keyword(),
                "문서", "보고서", "기획서", "계획서", "찾아줘", "찾아", "검색", "검색해줘", "관련", "최근", "있어", "있냐");
        List<DocumentEntity> all = documentRepository.findByOwnerAndDeletedAtIsNull(user);

        List<AiAssistantDto.ResultItem> results = all.stream()
                .filter(d -> keyword == null
                        || (d.getTitle() != null && d.getTitle().contains(keyword))
                        || (d.getOriginalContent() != null && d.getOriginalContent().contains(keyword)))
                .limit(MAX_RESULTS)
                .map(d -> AiAssistantDto.ResultItem.builder()
                        .type("document").title(d.getTitle() != null ? d.getTitle() : "(제목 없음)")
                        .summary(d.getAiSummary() != null && !d.getAiSummary().isBlank()
                                ? truncate(d.getAiSummary(), 60)
                                : (d.getOriginalContent() != null ? truncate(d.getOriginalContent(), 60) : ""))
                        .date(d.getCreatedAt() != null ? d.getCreatedAt().toLocalDate().toString() : "")
                        .targetId(d.getDocId()).route("document-storage").sourceLabel("문서보관함").build())
                .toList();

        String fallback = results.isEmpty()
                ? (keyword != null ? "\"" + keyword + "\" 관련 문서를 찾지 못했어요." : "저장된 문서가 없어요.")
                : (keyword != null ? "\"" + keyword + "\" 관련 문서 " + results.size() + "건을 찾았어요."
                        : "문서 " + results.size() + "건이에요.");

        return AiAssistantDto.AskResponse.builder()
                .answer(enrichAnswerWithLLM(prompt, buildDocumentContext(keyword, results), fallback))
                .intent("document_search").results(results)
                .actions(List.of(makeNavAction("문서보관함 바로가기", "document-storage")))
                .missingFields(List.of()).hasMore(false).build();
    }

    private AiAssistantDto.AskResponse handleFileSearch(String prompt, IntentResult ir, User user) {
        String keyword = resolveSearchKeyword(prompt, ir.keyword(),
                "파일", "첨부", "찾아줘", "찾아", "검색", "검색해줘", "관련", "최근", "있어", "있냐");
        List<FileItem> files = (keyword != null && !keyword.isBlank())
                ? fileItemRepository.findByUserAndKeyword(user.getUserId(), keyword)
                : fileItemRepository.findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(OwnerType.USER, user.getUserId());

        List<AiAssistantDto.ResultItem> results = files.stream().limit(MAX_RESULTS)
                .map(f -> AiAssistantDto.ResultItem.builder()
                        .type("file").title(f.getOriginalFileName())
                        .summary(f.getFileSize() != null ? formatFileSize(f.getFileSize()) : "")
                        .date(f.getUploadedAt() != null ? f.getUploadedAt().toLocalDate().toString() : "")
                        .targetId(f.getFileId()).route("file-storage").sourceLabel("파일 저장소").build())
                .toList();

        String fallback = results.isEmpty()
                ? (keyword != null ? "\"" + keyword + "\" 파일을 찾지 못했어요." : "저장된 파일이 없어요.")
                : (keyword != null ? "\"" + keyword + "\" 파일 " + results.size() + "건을 찾았어요."
                        : "파일 " + results.size() + "건이에요.");

        return AiAssistantDto.AskResponse.builder()
                .answer(enrichAnswerWithLLM(prompt, buildFileContext(keyword, results), fallback))
                .intent("file_search").results(results)
                .actions(List.of(makeNavAction("파일 저장소 바로가기", "file-storage")))
                .missingFields(List.of()).hasMore(false).build();
    }

    private AiAssistantDto.AskResponse handleApprovalQuery(String prompt, User user) {
        Page<ApprovalDoc> pending = approvalDocRepository.findPendingInbox(
                user.getUserId(), ApprovalLineStatus.ACTIVE, null, PageRequest.of(0, MAX_RESULTS));

        List<AiAssistantDto.ResultItem> results = pending.getContent().stream()
                .map(d -> AiAssistantDto.ResultItem.builder()
                        .type("approval").title(d.getTitle())
                        .summary("기안자: " + d.getDrafter().getName()
                                + (d.getCreatedAt() != null
                                        ? " · " + d.getCreatedAt().toLocalDate().format(DATE_FMT) : ""))
                        .date(d.getCreatedAt() != null ? d.getCreatedAt().toLocalDate().toString() : "")
                        .targetId(d.getId()).route("approval").sourceLabel("결재 대기함").build())
                .toList();

        String fallback = results.isEmpty()
                ? "결재 대기 중인 문서가 없어요."
                : "결재 대기 중인 문서가 " + pending.getTotalElements() + "건 있어요.";

        return AiAssistantDto.AskResponse.builder()
                .answer(enrichAnswerWithLLM(prompt, buildApprovalContext(results, pending.getTotalElements()), fallback))
                .intent("approval_query").results(results)
                .actions(List.of(makeNavAction("전자결재 바로가기", "approval")))
                .missingFields(List.of()).hasMore(pending.getTotalElements() > MAX_RESULTS).build();
    }

    private AiAssistantDto.AskResponse handleScheduledSend(String prompt, boolean confirm, User user) {
        try {
            AiAssistantDto.ScheduleResponse scheduleResp = aiScheduledActionService.parseOrSchedule(prompt, confirm, user);
            boolean hasMissing = scheduleResp.getMissingFields() != null && !scheduleResp.getMissingFields().isEmpty();
            String answer = confirm
                    ? "예약이 등록됐어요. 정해진 시간에 자동으로 발송할게요."
                    : (hasMissing ? "정보가 부족해요. 아래 내용을 확인해 주세요."
                            : "아래 내용으로 예약할까요? 확인 버튼을 눌러주세요.");

            List<AiAssistantDto.ActionItem> actions = (confirm || hasMissing)
                    ? List.of()
                    : List.of(AiAssistantDto.ActionItem.builder()
                            .label("예약 확정").actionType("confirm_send").payload(prompt).build());

            return AiAssistantDto.AskResponse.builder()
                    .answer(answer).intent("scheduled_send").results(List.of()).actions(actions)
                    .missingFields(scheduleResp.getMissingFields() != null ? scheduleResp.getMissingFields() : List.of())
                    .schedulePreview(scheduleResp).hasMore(false).build();
        } catch (Exception e) {
            return AiAssistantDto.AskResponse.builder()
                    .answer("예약 처리 중 오류가 발생했어요: " + e.getMessage())
                    .intent("scheduled_send").results(List.of()).actions(List.of())
                    .missingFields(List.of()).hasMore(false).build();
        }
    }

    private AiAssistantDto.AskResponse unknownResponse() {
        return AiAssistantDto.AskResponse.builder()
                .answer("요청을 이해하지 못했어요. 예시: \"오늘 뭐 있어?\", \"박부장님 메일 있어?\", \"결재 밀린 거\", \"10분 뒤 김성현에게 채팅 보내줘\"")
                .intent("unknown").results(List.of()).actions(List.of()).missingFields(List.of()).hasMore(false).build();
    }

    // ===== LLM Answer Generation =====

    private String enrichAnswerWithLLM(String userPrompt, String dataContext, String fallback) {
        String llm = callSecretaryLLM(userPrompt, dataContext);
        return (llm != null && !llm.isBlank()) ? llm : fallback;
    }

    @SuppressWarnings("unchecked")
    private String callSecretaryLLM(String userPrompt, String dataContext) {
        try {
            String fullPrompt = "업무 데이터를 보고 사용자 질문에 자연스러운 한국어로 답변하세요.\n\n"
                    + "반드시 지킬 것:\n"
                    + "- 데이터에 있는 실제 일정명·시간·발신자·제목을 직접 언급하세요\n"
                    + "- '총 N개입니다'처럼 개수만 말하지 말고 구체적인 내용을 말해주세요\n"
                    + "- 예시: '오전 10시 팀 회의, 오후 3시 고객 미팅이 잡혀 있어요'\n"
                    + "- 해당하는 데이터가 없으면 솔직하게 없다고 말하세요\n\n"
                    + "업무 데이터:\n" + dataContext + "\n\n"
                    + "질문: " + userPrompt + "\n"
                    + "답변:";
            Map<String, Object> body = Map.of(
                    "model", secretaryModel,
                    "prompt", fullPrompt,
                    "stream", false,
                    "options", Map.of("temperature", 0.4, "num_predict", 300)
            );
            Map<String, Object> response = ollamaRestClient.post()
                    .uri("/api/generate")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            if (response != null && response.get("response") != null) {
                return stripThinkTags(response.get("response").toString());
            }
        } catch (Exception e) {
            log.debug("Secretary LLM answer call failed: {}", e.getMessage());
        }
        return null;
    }

    // ===== Helpers =====

    private String stripThinkTags(String text) {
        if (text == null) return null;
        return text.replaceAll("(?s)<think>.*?</think>", "").trim();
    }

    private String toStringOrNull(Object obj) {
        if (obj == null) return null;
        String s = obj.toString().trim();
        return (s.isEmpty() || s.equalsIgnoreCase("null")) ? null : s;
    }

    // ===== Data Context Builders =====

    private String buildScheduleContext(String label, List<Schedule> schedules) {
        if (schedules.isEmpty()) return label + " 등록된 일정 없음";
        StringBuilder sb = new StringBuilder(label + " 일정 " + schedules.size() + "개:\n");
        schedules.stream().limit(MAX_RESULTS).forEach(s ->
                sb.append("- ").append(s.getTitle())
                        .append(" (").append(s.getStartDate().format(DATE_FMT))
                        .append(" ").append(s.getStartTime()).append("~").append(s.getEndTime()).append(")\n"));
        if (schedules.size() > MAX_RESULTS)
            sb.append("...추가 ").append(schedules.size() - MAX_RESULTS).append("개 더 있음");
        return sb.toString();
    }

    private String buildMailContext(String keyword, List<AiAssistantDto.ResultItem> results) {
        if (results.isEmpty()) return keyword != null ? "\"" + keyword + "\" 관련 메일 없음" : "메일 없음";
        StringBuilder sb = new StringBuilder("메일 " + results.size() + "건:\n");
        results.forEach(r -> sb.append("- [").append(r.getSourceLabel()).append("] ")
                .append(r.getTitle()).append(" (").append(r.getSummary()).append(")\n"));
        return sb.toString();
    }

    private String buildDocumentContext(String keyword, List<AiAssistantDto.ResultItem> results) {
        if (results.isEmpty()) return keyword != null ? "\"" + keyword + "\" 관련 문서 없음" : "등록된 문서 없음";
        StringBuilder sb = new StringBuilder("문서 " + results.size() + "건:\n");
        results.forEach(r -> sb.append("- ").append(r.getTitle()).append(" (").append(r.getDate()).append(")\n"));
        return sb.toString();
    }

    private String buildFileContext(String keyword, List<AiAssistantDto.ResultItem> results) {
        if (results.isEmpty()) return keyword != null ? "\"" + keyword + "\" 파일 없음" : "저장된 파일 없음";
        StringBuilder sb = new StringBuilder("파일 " + results.size() + "건:\n");
        results.forEach(r -> sb.append("- ").append(r.getTitle()).append(" (").append(r.getSummary()).append(")\n"));
        return sb.toString();
    }

    private String buildApprovalContext(List<AiAssistantDto.ResultItem> results, long total) {
        if (results.isEmpty()) return "결재 대기 문서 없음";
        StringBuilder sb = new StringBuilder("결재 대기 " + total + "건:\n");
        results.forEach(r -> sb.append("- ").append(r.getTitle()).append(" (").append(r.getSummary()).append(")\n"));
        return sb.toString();
    }

    // ===== Utilities =====

    private AiAssistantDto.ActionItem makeNavAction(String label, String route) {
        return AiAssistantDto.ActionItem.builder().label(label).actionType("navigate").payload(route).build();
    }

    private String resolveSearchKeyword(String prompt, String candidate, String... removeWords) {
        String normalized = normalizeKeyword(candidate, removeWords);
        return normalized != null ? normalized : extractKeyword(prompt, removeWords);
    }

    private String normalizeKeyword(String keyword, String... removeWords) {
        if (keyword == null || keyword.isBlank()) return null;
        String cleaned = keyword.trim();
        for (String w : removeWords) cleaned = cleaned.replace(w, " ");
        cleaned = cleaned
                .replaceAll("[\"'“”‘’]", " ")
                .replaceAll("[이가은는을를의에서로](?=\\s|$)", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.isBlank()) return null;
        if (isCommandWord(cleaned)) return null;
        return cleaned;
    }

    private String extractKeyword(String prompt, String... removeWords) {
        String cleaned = prompt;
        for (String w : removeWords) cleaned = cleaned.replace(w, " ");
        cleaned = cleaned
                .replaceAll("[\"'“”‘’]", " ")
                .replaceAll("[이가은는을를의에서로](?=\\s|$)", " ")
                .replaceAll("\\s+", " ").trim();
        if (cleaned.isBlank()) return null;
        for (String token : cleaned.split("\\s+")) {
            if (token.length() >= 2 && !isCommandWord(token)) return token;
        }
        return null;
    }

    private boolean isCommandWord(String value) {
        return containsAny(value, "찾아", "찾아줘", "검색", "검색해줘", "알려줘", "보여줘", "뭐야", "있어", "있냐", "최근");
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max) + "...";
    }

    private String formatFileSize(Long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024) + " KB";
        return (bytes / (1024 * 1024)) + " MB";
    }

    private boolean containsAny(String value, String... needles) {
        if (value == null) return false;
        for (String n : needles) {
            if (n != null && value.contains(n)) return true;
        }
        return false;
    }
}
