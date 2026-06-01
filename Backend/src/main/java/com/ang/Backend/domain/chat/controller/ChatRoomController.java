package com.ang.Backend.domain.chat.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.chat.repository.ChatMemberRepository;
import com.ang.Backend.domain.chat.repository.ChatRoomRepository;
import com.ang.Backend.domain.chat.service.ChatMessageService;
import com.ang.Backend.domain.chat.service.ChatRoomService;
import com.ang.Backend.domain.file.service.S3FileService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomService chatRoomService;
    private final ChatMessageService chatMessageService;
    private final S3FileService s3FileService;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final UserRepository userRepository;

    // 1:1 채팅방 생성 (이미 있으면 기존 방 반환)
    @PostMapping("/rooms/private")
    public ResponseEntity<ApiResponse<Long>> createPrivateRoom(
            @RequestBody ChatDto.CreatePrivateRoomRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(chatRoomService.createPrivateRoom(user, req)));
    }

    // 그룹 채팅방 생성
    @PostMapping("/rooms/group")
    public ResponseEntity<ApiResponse<Long>> createGroupRoom(
            @RequestBody ChatDto.CreateGroupRoomRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(chatRoomService.createGroupRoom(user, req)));
    }

    // 내 채팅방 목록
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<ChatDto.RoomSummary>>> getMyRooms(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(chatRoomService.getMyRooms(user)));
    }

    // 메시지 내역 (페이징)
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<List<ChatDto.MessageResponse>>> getMessages(
            @PathVariable Long roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(chatMessageService.getMessages(roomId, user, page, size)));
    }

    // 멤버 목록
    @GetMapping("/rooms/{roomId}/members")
    public ResponseEntity<ApiResponse<List<ChatDto.MemberInfo>>> getMembers(
            @PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(chatRoomService.getMembers(roomId, user)));
    }

    // 멤버 초대 (그룹방만)
    @PostMapping("/rooms/{roomId}/invite")
    public ResponseEntity<ApiResponse<Void>> invite(
            @PathVariable Long roomId,
            @RequestBody ChatDto.InviteRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        chatRoomService.invite(roomId, user, req);
        return ResponseEntity.ok(ApiResponse.ok("초대되었습니다."));
    }

    // 채팅방 나가기
    @PostMapping("/rooms/{roomId}/leave")
    public ResponseEntity<ApiResponse<Void>> leave(
            @PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        chatRoomService.leave(roomId, user);
        return ResponseEntity.ok(ApiResponse.ok("채팅방에서 나갔습니다."));
    }

    // 채팅방 이름 개인 설정 (본인에게만 적용)
    @PatchMapping("/rooms/{roomId}/name")
    public ResponseEntity<ApiResponse<Void>> updateMyRoomName(
            @PathVariable Long roomId,
            @RequestBody ChatDto.UpdateRoomNameRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        chatRoomService.updateMyRoomName(roomId, user, req.getName());
        return ResponseEntity.ok(ApiResponse.ok("채팅방 이름이 변경되었습니다."));
    }

    // 읽음 처리
    @PostMapping("/rooms/{roomId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        chatRoomService.markAsRead(roomId, user);
        return ResponseEntity.ok(ApiResponse.ok("읽음 처리되었습니다."));
    }

    // 파일 다운로드
    @GetMapping("/files")
    public ResponseEntity<byte[]> downloadFile(
            @RequestParam String key,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);

        String[] parts = key.split("/");
        if (parts.length < 2) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        Long roomId = Long.parseLong(parts[1]);

        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));

        chatMemberRepository.findByRoomAndUser(room, user)
                .filter(m -> m.getLeftAt() == null)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));

        byte[] bytes = s3FileService.download(key);
        String fileName = key.substring(key.lastIndexOf("/") + 1);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    // 파일 업로드 → S3 저장 후 URL 반환
    @PostMapping("/files")
    public ResponseEntity<ApiResponse<ChatDto.FileUploadResponse>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("roomId") Long roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));
        chatMemberRepository.findByRoomAndUser(room, user)
                .filter(m -> m.getLeftAt() == null)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        String key = s3FileService.upload(file, "chat/" + roomId);
        return ResponseEntity.ok(ApiResponse.ok(ChatDto.FileUploadResponse.builder()
                .fileUrl(key)
                .fileName(file.getOriginalFilename())
                .build()));
    }

    

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
