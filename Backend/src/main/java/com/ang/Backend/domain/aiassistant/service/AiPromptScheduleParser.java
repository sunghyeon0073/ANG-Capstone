package com.ang.Backend.domain.aiassistant.service;

import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.domain.aiassistant.entity.ScheduledAction;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionChannel;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class AiPromptScheduleParser {

    private static final Pattern ROOM_ID_PATTERN = Pattern.compile("(?:roomId|room_id|채팅방)\\s*[:#]??\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ISO_DATE_PATTERN = Pattern.compile("(20\\d{2})[-./](\\d{1,2})[-./](\\d{1,2})");
    private static final Pattern KOREAN_DATE_PATTERN = Pattern.compile("(\\d{1,2})월\\s*(\\d{1,2})일");
    private static final Pattern TIME_PATTERN = Pattern.compile("(오전|오후|아침|저녁|밤)?\\s*(\\d{1,2})시(?:\\s*(\\d{1,2})분)?");
    private static final Pattern RELATIVE_HOUR_PATTERN = Pattern.compile("(\\d+)\\s*시간\\s*(?:뒤|후|있다가)");
    private static final Pattern RELATIVE_MIN_PATTERN = Pattern.compile("(\\d+)\\s*분\\s*(?:뒤|후|있다가)");
    private static final Pattern TITLE_PATTERN = Pattern.compile("(?:제목|타이틀)\\s*(?:은|는|:)\\s*([^\\n,]+)");
    private static final Pattern TITLE_BEFORE_NOUN = Pattern.compile(
            "(.+?)\\s*(?:이라는|라는|인)\\s*(?:제목|타이틀)(?:이|가|을|를|에|으로|로)?");
    private static final Pattern FILE_ID_PATTERN = Pattern.compile("(?:fileId|file_id|파일)\\s*[:#]\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    // parseMessage 전용 패턴들
    private static final Pattern MSG_QUOTED = Pattern.compile(
            "[\u201c\u201d\u2018\u2019\"'](.*?)[\u201c\u201d\u2018\u2019\"']");
    private static final Pattern MSG_CONTENT_KEYWORD = Pattern.compile(
            "(?:내용|본문|메시지|메세지)\\s*(?:은|는|:)?\\s*(.+?)(?:\\s*(?:라고|으로|로)\\s*)?(?:예약|보내|전송|발송|$)");
    private static final Pattern MSG_BEFORE_CONTENT_NOUN = Pattern.compile(
            "(.+?)\\s*(?:이라는|라는|인)\\s*(?:내용|본문|메시지|메세지)(?:이|가|을|를|으로|로)?");
    // 수신자 마커(에게/한테/께) + 선택적 채널 뒤의 메시지 내용을 추출
    private static final Pattern MSG_AFTER_RECIPIENT = Pattern.compile(
            "(?:에게는?|한테는?|께는?)(?:\\s*\\S+(?:으로|로))?\\s+(.+?)\\s*(?:이라고|라고)\\s*(?:예약|보내|전송|발송|알려)");
    // 이라고/라고 보내 앞의 전체 내용 (greedy)
    private static final Pattern MSG_BEFORE_QUOTE_SEND = Pattern.compile(
            "(.+)\\s*(?:이라고|라고)\\s*(?:예약|보내|전송|발송|알려)");
    // 구조적 prefix(에게/채널) 뒤를 찾아 앞부분을 잘라내기 위한 패턴
    private static final Pattern MSG_STRUCTURAL_PREFIX = Pattern.compile(
            "^.*(?:에게는?|한테는?|께는?|\\S+(?:으로|로))\\s+");

    private final UserRepository userRepository;
    private final FileItemRepository fileItemRepository;

    public ParsedSchedule parse(String prompt, User requester) {
        String normalized = prompt == null ? "" : prompt.trim();
        ScheduledActionChannel channel = parseChannel(normalized);
        LocalDateTime scheduledAt = parseScheduledAt(normalized);
        boolean sendIntent = hasSendIntent(normalized);
        if (channel == null && sendIntent) {
            channel = ScheduledActionChannel.CHAT;
        }
        if (scheduledAt == null && sendIntent) {
            scheduledAt = LocalDateTime.now();
        }
        List<User> recipients = parseRecipients(normalized, requester);
        List<Long> fileIds = parseFileIds(normalized, requester);
        Long roomId = parseRoomId(normalized);
        String message = parseMessage(normalized);
        String title = parseTitle(normalized, channel, message);

        List<String> missing = new ArrayList<>();
        if (channel == null) missing.add("channel");
        if (scheduledAt == null) missing.add("scheduledAt");
        if (message == null || message.isBlank()) missing.add("message");
        if (channel == ScheduledActionChannel.MAIL && recipients.isEmpty()) missing.add("recipient");
        if (channel == ScheduledActionChannel.CHAT && roomId == null && recipients.isEmpty()) missing.add("recipientOrChatRoom");
        if (channel == ScheduledActionChannel.MAIL && (title == null || title.isBlank())) missing.add("title");

        ScheduledAction action = ScheduledAction.builder()
                .requester(requester)
                .channel(channel)
                .scheduledAt(scheduledAt)
                .recipientEmpNos(joinStrings(recipients.stream().map(User::getEmpNo).toList()))
                .recipientNames(joinStrings(recipients.stream().map(User::getName).toList()))
                .chatRoomId(roomId)
                .title(title)
                .message(message)
                .fileIds(joinLongs(fileIds))
                .originalPrompt(normalized)
                .build();

        return ParsedSchedule.builder()
                .action(action)
                .recipientEmpNos(recipients.stream().map(User::getEmpNo).toList())
                .recipientNames(recipients.stream().map(User::getName).toList())
                .fileIds(fileIds)
                .missingFields(missing)
                .build();
    }

    private ScheduledActionChannel parseChannel(String prompt) {
        if (containsAny(prompt, "메일", "이메일", "mail")) return ScheduledActionChannel.MAIL;
        if (containsAny(prompt, "채팅", "메시지", "메세지", "쪽지", "chat")) return ScheduledActionChannel.CHAT;
        return null;
    }

    private boolean hasSendIntent(String prompt) {
        return containsAny(prompt, "보내", "전송", "발송", "전달", "알려줘", "말해줘");
    }

    private LocalDateTime parseScheduledAt(String prompt) {
        // 상대 시간 먼저 처리: "N시간 뒤/후", "N분 뒤/후"
        Matcher relHourMatcher = RELATIVE_HOUR_PATTERN.matcher(prompt);
        if (relHourMatcher.find()) {
            return LocalDateTime.now().plusHours(Long.parseLong(relHourMatcher.group(1)));
        }
        Matcher relMinMatcher = RELATIVE_MIN_PATTERN.matcher(prompt);
        if (relMinMatcher.find()) {
            return LocalDateTime.now().plusMinutes(Long.parseLong(relMinMatcher.group(1)));
        }

        LocalDate baseDate = LocalDate.now();
        LocalDate date = null;

        if (prompt.contains("모레")) date = baseDate.plusDays(2);
        else if (prompt.contains("내일")) date = baseDate.plusDays(1);
        else if (prompt.contains("오늘")) date = baseDate;

        Matcher isoMatcher = ISO_DATE_PATTERN.matcher(prompt);
        if (isoMatcher.find()) {
            date = LocalDate.of(
                    Integer.parseInt(isoMatcher.group(1)),
                    Integer.parseInt(isoMatcher.group(2)),
                    Integer.parseInt(isoMatcher.group(3))
            );
        }

        Matcher koreanMatcher = KOREAN_DATE_PATTERN.matcher(prompt);
        if (koreanMatcher.find()) {
            int month = Integer.parseInt(koreanMatcher.group(1));
            int day = Integer.parseInt(koreanMatcher.group(2));
            date = LocalDate.of(baseDate.getYear(), month, day);
            if (date.isBefore(baseDate)) date = date.plusYears(1);
        }

        Matcher timeMatcher = TIME_PATTERN.matcher(prompt);
        if (!timeMatcher.find()) return null;

        String dayPart = timeMatcher.group(1);
        int hour = Integer.parseInt(timeMatcher.group(2));
        int minute = timeMatcher.group(3) == null ? 0 : Integer.parseInt(timeMatcher.group(3));
        if (("오후".equals(dayPart) || "저녁".equals(dayPart) || "밤".equals(dayPart)) && hour < 12) hour += 12;
        if ("오전".equals(dayPart) && hour == 12) hour = 0;
        if (hour > 23 || minute > 59) return null;

        LocalTime time = LocalTime.of(hour, minute);
        if (date == null) {
            date = baseDate;
            if (LocalDateTime.of(date, time).isBefore(LocalDateTime.now())) {
                date = date.plusDays(1);
            }
        }
        return LocalDateTime.of(date, time);
    }

    private List<User> parseRecipients(String prompt, User requester) {
        return userRepository.findByPromptMention(prompt, requester.getUserId()).stream()
                .distinct()
                .toList();
    }

    private List<Long> parseFileIds(String prompt, User requester) {
        Set<Long> ids = new LinkedHashSet<>();
        Matcher matcher = FILE_ID_PATTERN.matcher(prompt);
        while (matcher.find()) {
            ids.add(Long.parseLong(matcher.group(1)));
        }

        fileItemRepository.findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(OwnerType.USER, requester.getUserId()).stream()
                .filter(file -> file.getOriginalFileName() != null && prompt.contains(file.getOriginalFileName()))
                .map(FileItem::getFileId)
                .forEach(ids::add);
        return new ArrayList<>(ids);
    }

    private Long parseRoomId(String prompt) {
        Matcher matcher = ROOM_ID_PATTERN.matcher(prompt);
        return matcher.find() ? Long.parseLong(matcher.group(1)) : null;
    }

    private String parseTitle(String prompt, ScheduledActionChannel channel, String message) {
        Matcher matcher = TITLE_PATTERN.matcher(prompt);
        if (matcher.find()) return cleanEnding(matcher.group(1));
        Matcher beforeMatcher = TITLE_BEFORE_NOUN.matcher(prompt);
        if (beforeMatcher.find()) {
            String raw = beforeMatcher.group(1).trim();
            String stripped = MSG_STRUCTURAL_PREFIX.matcher(raw).replaceFirst("").trim();
            if (stripped.isBlank()) stripped = raw;
            String title = cleanMessage(stripped);
            if (!title.isBlank()) return title;
        }
        if (channel != ScheduledActionChannel.MAIL) return null;
        if (message != null && !message.isBlank()) {
            String compact = message.length() > 24 ? message.substring(0, 24) + "..." : message;
            return compact + " 메일";
        }
        return "예약 메일";
    }

    private String parseMessage(String prompt) {
        // 1. 따옴표로 감싸진 내용
        Matcher m1 = MSG_QUOTED.matcher(prompt);
        if (m1.find()) {
            String msg = cleanEnding(m1.group(1));
            if (!msg.isBlank()) return msg;
        }
        // 2. "OOO라는 본문/내용"처럼 본문 명사 앞에 실제 메시지가 오는 표현
        Matcher m0 = MSG_BEFORE_CONTENT_NOUN.matcher(prompt);
        if (m0.find()) {
            String raw = m0.group(1).trim();
            String stripped = MSG_STRUCTURAL_PREFIX.matcher(raw).replaceFirst("").trim();
            if (stripped.isBlank()) stripped = raw;
            String msg = cleanMessage(stripped);
            if (!msg.isBlank()) return msg;
        }
        // 3. "내용/본문" 키워드 뒤
        Matcher m2 = MSG_CONTENT_KEYWORD.matcher(prompt);
        if (m2.find()) {
            String msg = cleanEnding(m2.group(1));
            if (!msg.isBlank()) return msg;
        }
        // 4. 수신자 마커(에게/한테/께) 이후 ~ 이라고/라고 보내 이전 (lazy — 마커 뒤부터 시작하므로 수신자/채널 정보 제외)
        Matcher m3 = MSG_AFTER_RECIPIENT.matcher(prompt);
        if (m3.find()) {
            String msg = cleanMessage(m3.group(1));
            if (!msg.isBlank()) return msg;
        }
        // 5. "이라고/라고 보내" 앞 전체에서 구조적 prefix(수신자/채널) 제거
        Matcher m4 = MSG_BEFORE_QUOTE_SEND.matcher(prompt);
        if (m4.find()) {
            String raw = m4.group(1).trim();
            String stripped = MSG_STRUCTURAL_PREFIX.matcher(raw).replaceFirst("").trim();
            if (stripped.isBlank()) stripped = raw;
            String msg = cleanMessage(stripped);
            if (!msg.isBlank()) return msg;
        }
        return null;
    }

    private boolean containsAny(String value, String... needles) {
        if (value == null) return false;
        for (String needle : needles) {
            if (needle != null && !needle.isBlank() && value.contains(needle)) return true;
        }
        return false;
    }

    private String cleanEnding(String value) {
        if (value == null) return "";
        return value.trim()
                .replaceAll("\\s+", " ")
                .replaceAll("[.。]$", "")
                .trim();
    }

    private String cleanMessage(String value) {
        return cleanEnding(value)
                .replaceAll("^.*(?:제목|타이틀)\\s*(?:에|으로|로|,)?\\s*", "")
                .replaceAll("^(?:메일|이메일|채팅|메시지|메세지)\\s*(?:으로|로|과|와|은|는|을|를)?\\s*", "")
                .replaceAll("^(?:과|와)\\s+", "")
                .trim();
    }

    private String joinStrings(List<String> values) {
        return values == null || values.isEmpty() ? "" : String.join(",", values);
    }

    private String joinLongs(List<Long> values) {
        return values == null || values.isEmpty() ? "" : String.join(",", values.stream().map(String::valueOf).toList());
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    @Getter
    @Builder
    public static class ParsedSchedule {
        private ScheduledAction action;
        private List<String> recipientEmpNos;
        private List<String> recipientNames;
        private List<Long> fileIds;
        private List<String> missingFields;
    }
}
