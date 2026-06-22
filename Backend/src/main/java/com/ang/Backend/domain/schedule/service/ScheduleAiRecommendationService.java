package com.ang.Backend.domain.schedule.service;

import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleAiRecommendationService {

    private final RestClient ollamaRestClient;
    private final ObjectMapper objectMapper;

    @Value("${ollama.secretary-model:ang-secretary:latest}")
    private String secretaryModel;

    private static final int MAX_HISTORY_ITEMS = 150;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

    public List<ScheduleDto.AiRecommendationResponse> recommend(User owner, List<Schedule> historySchedules, LocalDate rangeStart, LocalDate rangeEnd) {
        if (historySchedules == null || historySchedules.isEmpty()) return List.of();

        try {
            String context = buildHistoryContext(historySchedules);
            String raw = callSecretaryLLM(buildPrompt(context, rangeStart, rangeEnd));
            if (raw == null || raw.isBlank()) return List.of();

            return parseRecommendations(raw, rangeStart, rangeEnd);
        } catch (Exception e) {
            log.warn("LLM-based schedule recommendation failed, skipping: {}", e.getMessage());
            return List.of();
        }
    }

    private String buildHistoryContext(List<Schedule> historySchedules) {
        StringBuilder sb = new StringBuilder();
        historySchedules.stream()
                .limit(MAX_HISTORY_ITEMS)
                .forEach(s -> sb.append("- ")
                        .append(s.getStartDate().format(DATE_FMT))
                        .append(" ")
                        .append(s.getTitle())
                        .append("\n"));
        return sb.toString();
    }

    private String buildPrompt(String historyContext, LocalDate rangeStart, LocalDate rangeEnd) {
        return "너는 ANG 그룹웨어의 일정 추천 비서입니다. 아래는 사용자의 과거 일정 이력입니다.\n\n"
                + historyContext + "\n"
                + "이 이력을 참고해서 " + rangeStart.format(DATE_FMT) + " ~ " + rangeEnd.format(DATE_FMT)
                + " 기간 동안 등록하면 좋을 업무를 추천하세요.\n\n"
                + "규칙:\n"
                + "- 반드시 위 이력에 근거해서만 추천하세요. 이력에 없는 새로운 업무를 지어내지 마세요.\n"
                + "- date는 반드시 " + rangeStart.format(DATE_FMT) + "부터 " + rangeEnd.format(DATE_FMT) + " 사이여야 합니다.\n"
                + "- 근거가 부족하면 빈 배열 []을 출력하세요.\n"
                + "- 설명 없이 JSON 배열만 출력하세요.\n\n"
                + "출력 형식:\n"
                + "[{\"title\":\"업무 제목\",\"date\":\"YYYY-MM-DD\",\"reason\":\"추천 이유(한국어 한 문장)\"}]\n";
    }

    @SuppressWarnings("unchecked")
    private String callSecretaryLLM(String prompt) {
        Map<String, Object> body = Map.of(
                "model", secretaryModel,
                "prompt", prompt,
                "stream", false,
                "options", Map.of("temperature", 0.2, "num_predict", 400, "num_ctx", 4096)
        );
        Map<String, Object> response = ollamaRestClient.post()
                .uri("/api/generate")
                .body(body)
                .retrieve()
                .body(Map.class);
        if (response == null || response.get("response") == null) return null;
        return stripThinkTags(response.get("response").toString());
    }

    private List<ScheduleDto.AiRecommendationResponse> parseRecommendations(String raw, LocalDate rangeStart, LocalDate rangeEnd) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start == -1 || end <= start) return List.of();

        List<Map<String, Object>> items;
        try {
            items = objectMapper.readValue(raw.substring(start, end + 1), List.class);
        } catch (Exception e) {
            log.debug("Failed to parse LLM recommendation JSON: {}", e.getMessage());
            return List.of();
        }

        List<ScheduleDto.AiRecommendationResponse> results = new ArrayList<>();
        for (Map<String, Object> item : items) {
            String title = asTrimmedString(item.get("title"));
            String reason = asTrimmedString(item.get("reason"));
            LocalDate date = parseDate(asTrimmedString(item.get("date")));

            if (title == null || title.isBlank() || date == null) continue;
            if (date.isBefore(rangeStart) || date.isAfter(rangeEnd)) continue;

            results.add(ScheduleDto.AiRecommendationResponse.builder()
                    .id("llm-" + title.hashCode() + "-" + date)
                    .type("llm")
                    .title("AI 업무 추천")
                    .message(reason != null && !reason.isBlank() ? reason : title + " 일정을 등록해 보세요.")
                    .recommendationDate(date)
                    .sourceStartDate(date)
                    .sourceEndDate(date)
                    .sourceTitle(title)
                    .build());
        }
        return results;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim(), DATE_FMT);
        } catch (Exception e) {
            return null;
        }
    }

    private String asTrimmedString(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() || s.equalsIgnoreCase("null") ? null : s;
    }

    private String stripThinkTags(String text) {
        if (text == null) return null;
        return text.replaceAll("(?s)<think>.*?</think>", "").trim();
    }
}
