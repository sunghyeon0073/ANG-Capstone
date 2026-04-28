package org.example.capstoneBack.domain.chat.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.chat.dto.ChatMessageDto;
import org.example.capstoneBack.domain.chat.dto.ChatRoomCreateRequest;
import org.example.capstoneBack.domain.chat.entity.ChatRoom;
import org.example.capstoneBack.domain.chat.service.ChatService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /** Chat-01-1/2: 내 채팅방 목록 */
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<ChatRoom>>> getMyChatRooms(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                chatService.getMyChatRooms(userDetails.getUsername())));
    }

    /** 채팅방 생성 (1:1 / 그룹) */
    @PostMapping("/rooms")
    public ResponseEntity<ApiResponse<ChatRoom>> createChatRoom(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChatRoomCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(chatService.createChatRoom(userDetails.getUsername(), request)));
    }

    /** 메시지 전송 */
    @PostMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<ChatMessageDto>> sendMessage(
            @PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String content) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        chatService.sendMessage(roomId, userDetails.getUsername(), content)));
    }

    /** 메시지 목록 조회 (페이징, 최신순) */
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<Page<ChatMessageDto>>> getMessages(
            @PathVariable Long roomId,
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 30) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                chatService.getMessages(roomId, userDetails.getUsername(), pageable)));
    }
}
