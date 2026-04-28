package org.example.capstoneBack.domain.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.example.capstoneBack.common.enums.BoardType;

@Getter
@NoArgsConstructor
public class BoardCreateRequest {

    @NotNull(message = "게시판 유형을 선택하세요.")
    private BoardType boardType;

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    @NotBlank(message = "내용을 입력하세요.")
    private String content;

    @NotNull(message = "부서를 선택하세요.")
    private Long scopeId;
}
