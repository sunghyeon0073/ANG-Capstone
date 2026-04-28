package org.example.capstoneBack.domain.board.repository;

import org.example.capstoneBack.common.enums.BoardType;
import org.example.capstoneBack.domain.board.entity.Board;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoardRepository extends JpaRepository<Board, Long> {

    Page<Board> findByScopeScopeId(Long scopeId, Pageable pageable);

    Page<Board> findByScopeScopeIdAndBoardType(Long scopeId, BoardType boardType, Pageable pageable);

    @Query("SELECT b FROM Board b WHERE b.scope.scopeId = :scopeId AND (b.title LIKE %:keyword% OR b.content LIKE %:keyword%)")
    Page<Board> searchByKeyword(@Param("scopeId") Long scopeId,
                                 @Param("keyword") String keyword,
                                 Pageable pageable);

    @Query("SELECT b FROM Board b WHERE b.scope.scopeId = :scopeId AND b.boardType = :boardType AND (b.title LIKE %:keyword% OR b.content LIKE %:keyword%)")
    Page<Board> searchByKeywordAndType(@Param("scopeId") Long scopeId,
                                        @Param("boardType") BoardType boardType,
                                        @Param("keyword") String keyword,
                                        Pageable pageable);
}
