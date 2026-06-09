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
    private static final Pattern TITLE_PATTERN = Pattern.compile("(?:제목|타이틀)\\s*(?:은|는|:)?\\s*([^\\n,]+)");
    private static final Pattern FILE_ID_PATTERN = Pattern.compile("(?:fileId|file_id|파일)\\s*[:#]\\s*(\\d+)", Pattern.CASE_INSENSITIVE);

    private final UserRepository userRepository;
    private final FileItemRepository fileItemRepository;

    public ParsedSchedule parse(String prompt, User requester) {
        String normalized = prompt == null ? "" : prompt.trim();
        ScheduledActionChannel channel = parseChannel(normalized);
        LocalDateTime scheduledAt = parseScheduledAt(normalized);
        List<User> recipients = parseRecipients(normalized, requester);
        List<Long> fileIds = parseFileIds(normalized, requester);
        Long roomId = parseRoomId(normalized);
        String title = parseTitle(normalized, channel);
        String message = parseMessage(normalized);

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

    private LocalDateTime parseScheduledAt(String prompt) {
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

    private String parseTitle(String prompt, ScheduledActionChannel channel) {
        Matcher matcher = TITLE_PATTERN.matcher(prompt);
        if (matcher.find()) return cleanEnding(matcher.group(1));
        return channel == ScheduledActionChannel.MAIL ? "예약 메일" : null;
    }

    private String parseMessage(String prompt) {
        List<Pattern> patterns = List.of(
                Pattern.compile("[\"'“”‘’](.+?)[\"'“”‘’]"),
                Pattern.compile("(?:내용|본문|메시지|메세지)\\s*(?:은|는|:)?\\s*(.+?)(?:\\s*(?:라고|으로|로)\\s*)?(?:예약|보내|전송|발송|$)"),
                Pattern.compile("(.+?)\\s*라고\\s*(?:예약|보내|전송|발송)")
        );
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(prompt);
            if (matcher.find()) {
                String message = cleanEnding(matcher.group(1));
                if (!message.isBlank()) return message;
            }
        }
        return cleanEnding(prompt
                .replaceAll("(오늘|내일|모레|오전|오후|아침|저녁|밤|\\d{1,2}시|\\d{1,2}분)", " ")
                .replaceAll("(메일|이메일|채팅|메시지|메세지|예약|보내줘|보내|전송|발송)", " "));
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
