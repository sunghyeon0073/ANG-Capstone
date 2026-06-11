package com.ang.Backend.domain.board.repository;

import com.ang.Backend.domain.board.entity.BoardPost;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    @Query("SELECT p FROM BoardPost p ORDER BY p.pinned DESC, p.createdAt DESC")
    List<BoardPost> findAllOrderByPinnedAndCreatedAt();

    @Query("SELECT p FROM BoardPost p WHERE p.type = :type ORDER BY p.pinned DESC, p.createdAt DESC")
    List<BoardPost> findByTypeOrderByPinnedAndCreatedAt(@Param("type") String type);

    @Query("SELECT p FROM BoardPost p WHERE p.author = :author ORDER BY p.pinned DESC, p.createdAt DESC")
    List<BoardPost> findByAuthorOrderByPinnedAndCreatedAt(@Param("author") User author);
}
