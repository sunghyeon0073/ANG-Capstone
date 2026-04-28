package org.example.capstoneBack.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.example.capstoneBack.common.enums.RoomType;

import java.util.List;

@Getter
@NoArgsConstructor
public class ChatRoomCreateRequest {

    @NotNull(message = "채팅 유형을 선택하세요.")
    private RoomType roomType;

    private String roomName;

    @NotNull(message = "참여자를 선택하세요.")
    private List<Long> memberIds;
}
