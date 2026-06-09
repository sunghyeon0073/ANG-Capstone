package com.ang.Backend.domain.chat.entity;

import com.ang.Backend.common.enums.ChatRoomType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_rooms")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 10)
    private ChatRoomType type;

    // PRIVATE 방 멤버 조합 키 ('<minUserId>:<maxUserId>'). GROUP 방은 null.
    // uk_private_pair 유니크 제약으로 동일 사용자 조합 중복 PRIVATE 방 생성 차단
    @Column(name = "participant_key", length = 64)
    private String participantKey;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "last_message_content", length = 200)
    private String lastMessageContent;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "last_message_sender", length = 50)
    private String lastMessageSender;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
