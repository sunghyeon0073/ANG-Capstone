package org.example.capstoneBack.domain.board.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.BoardType;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.board.dto.BoardCreateRequest;
import org.example.capstoneBack.domain.board.dto.BoardDto;
import org.example.capstoneBack.domain.board.dto.CommentDto;
import org.example.capstoneBack.domain.board.entity.Board;
import org.example.capstoneBack.domain.board.entity.Comment;
import org.example.capstoneBack.domain.board.repository.BoardRepository;
import org.example.capstoneBack.domain.board.repository.CommentRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BoardService {

    private final BoardRepository boardRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;

    @Transactional(readOnly = true)
    public Page<BoardDto> getBoards(Long scopeId, BoardType boardType, String keyword, Pageable pageable) {
        if (keyword != null && !keyword.isBlank()) {
            if (boardType != null) {
                return boardRepository.searchByKeywordAndType(scopeId, boardType, keyword, pageable)
                        .map(BoardDto::from);
            }
            return boardRepository.searchByKeyword(scopeId, keyword, pageable).map(BoardDto::from);
        }
        if (boardType != null) {
            return boardRepository.findByScopeScopeIdAndBoardType(scopeId, boardType, pageable)
                    .map(BoardDto::from);
        }
        return boardRepository.findByScopeScopeId(scopeId, pageable).map(BoardDto::from);
    }

    @Transactional(readOnly = true)
    public BoardDto getBoard(Long postId) {
        return BoardDto.from(findById(postId));
    }

    @Transactional
    public BoardDto createBoard(String empNo, BoardCreateRequest request) {
        User author = findUserByEmpNo(empNo);
        Scope scope = findScopeById(request.getScopeId());

        Board board = Board.builder()
                .scope(scope)
                .author(author)
                .boardType(request.getBoardType())
                .title(request.getTitle())
                .content(request.getContent())
                .build();
        return BoardDto.from(boardRepository.save(board));
    }

    @Transactional
    public BoardDto updateBoard(Long postId, String empNo, String title, String content, int roleLevel) {
        Board board = findById(postId);
        User user = findUserByEmpNo(empNo);
        // 본인 또는 관리자(50 이상)
        if (!board.getAuthor().getUserId().equals(user.getUserId()) && roleLevel < 50) {
            throw new CustomException(ErrorCode.NOT_AUTHOR);
        }
        board.update(title, content);
        return BoardDto.from(board);
    }

    @Transactional
    public void deleteBoard(Long postId, String empNo, int roleLevel) {
        Board board = findById(postId);
        User user = findUserByEmpNo(empNo);
        if (!board.getAuthor().getUserId().equals(user.getUserId()) && roleLevel < 50) {
            throw new CustomException(ErrorCode.NOT_AUTHOR);
        }
        boardRepository.delete(board);
    }

    // 댓글
    @Transactional(readOnly = true)
    public List<CommentDto> getComments(Long postId) {
        return commentRepository.findByBoardPostIdOrderByCreatedAtAsc(postId)
                .stream().map(CommentDto::from).toList();
    }

    @Transactional
    public CommentDto createComment(Long postId, String empNo, String content) {
        User author = findUserByEmpNo(empNo);
        Board board = findById(postId);
        Comment comment = Comment.builder()
                .board(board).author(author).content(content).build();
        return CommentDto.from(commentRepository.save(comment));
    }

    @Transactional
    public void deleteComment(Long commentId, String empNo, int roleLevel) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new CustomException(ErrorCode.COMMENT_NOT_FOUND));
        User user = findUserByEmpNo(empNo);
        if (!comment.getAuthor().getUserId().equals(user.getUserId()) && roleLevel < 50) {
            throw new CustomException(ErrorCode.NOT_AUTHOR);
        }
        commentRepository.delete(comment);
    }

    private Board findById(Long postId) {
        return boardRepository.findById(postId)
                .orElseThrow(() -> new CustomException(ErrorCode.BOARD_NOT_FOUND));
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Scope findScopeById(Long scopeId) {
        return scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
