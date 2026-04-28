package org.example.capstoneBack.domain.board.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.BoardType;
import org.example.capstoneBack.domain.board.entity.Board;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class BoardDto {

    private Long postId;
    private Long scopeId;
    private Long authorId;
    private String authorName;
    private BoardType boardType;
    private String title;
    private String content;
    private LocalDateTime createdAt;

    public static BoardDto from(Board board) {
        return BoardDto.builder()
                .postId(board.getPostId())
                .scopeId(board.getScope().getScopeId())
                .authorId(board.getAuthor().getUserId())
                .authorName(board.getAuthor().getName())
                .boardType(board.getBoardType())
                .title(board.getTitle())
                .content(board.getContent())
                .createdAt(board.getCreatedAt())
                .build();
    }
}
