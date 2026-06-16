package com.ang.Backend.domain.board.service;

import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.board.dto.BoardPostDto;
import com.ang.Backend.domain.board.entity.BoardAttachment;
import com.ang.Backend.domain.board.entity.BoardPost;
import com.ang.Backend.domain.board.repository.BoardAttachmentRepository;
import com.ang.Backend.domain.board.repository.BoardPostRepository;
import com.ang.Backend.domain.file.service.S3FileService;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardPostService {

    private final BoardPostRepository boardPostRepository;
    private final BoardAttachmentRepository boardAttachmentRepository;
    private final S3FileService s3FileService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public List<BoardPostDto.Response> getPosts(String type, User currentUser) {
        List<BoardPost> posts;
        if ("my".equals(type)) {
            posts = boardPostRepository.findByAuthorOrderByPinnedAndCreatedAt(currentUser);
        } else if ("notice".equals(type) || "general".equals(type)) {
            posts = boardPostRepository.findByTypeOrderByPinnedAndCreatedAt(type);
        } else {
            posts = boardPostRepository.findAllOrderByPinnedAndCreatedAt();
        }
        return posts.stream().map(BoardPostDto.Response::from).collect(Collectors.toList());
    }

    @Transactional
    public BoardPostDto.Response createPost(User author, BoardPostDto.CreateRequest request) {
        BoardPost post = BoardPost.builder()
                .author(author)
                .title(request.getTitle())
                .content(request.getContent())
                .type(request.getType() != null ? request.getType() : "general")
                .pinned(request.isPinned())
                .build();
        BoardPost saved = boardPostRepository.save(post);
        sendBoardNotification(author, saved);
        return BoardPostDto.Response.from(saved);
    }

    private void sendBoardNotification(User author, BoardPost post) {
        String category = "notice".equals(post.getType()) ? "공지" : "게시글";
        String title = "[게시판] 새 " + category + "가 등록되었습니다.";
        String body = author.getName() + " · " + post.getTitle();
        userRepository.findByStatus(UserStatus.ACTIVE).stream()
                .filter(u -> !u.getUserId().equals(author.getUserId()))
                .forEach(u -> notificationService.send(u, NotificationType.BOARD, title, body, post.getPostId()));
    }

    @Transactional
    public BoardPostDto.Response updatePost(User currentUser, Long postId, BoardPostDto.UpdateRequest request) {
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT));
        if (!post.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        post.update(request.getTitle(), request.getContent(), request.getType(), request.isPinned());
        return BoardPostDto.Response.from(post);
    }

    @Transactional
    public void deletePost(User currentUser, Long postId) {
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT));
        if (!post.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        boardPostRepository.delete(post);
    }

    @Transactional
    public BoardPostDto.Response incrementViews(Long postId) {
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT));
        post.incrementViews();
        return BoardPostDto.Response.from(post);
    }

    @Transactional
    public BoardPostDto.AttachmentInfo uploadAttachment(Long postId, MultipartFile file, User currentUser) {
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT));
        if (!post.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        String fileUrl = s3FileService.upload(file, "board/" + postId);
        BoardAttachment attachment = BoardAttachment.builder()
                .post(post)
                .fileUrl(fileUrl)
                .fileName(file.getOriginalFilename())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .build();
        return BoardPostDto.AttachmentInfo.from(boardAttachmentRepository.save(attachment));
    }

    public ResponseEntity<byte[]> downloadAttachment(Long attachmentId) {
        BoardAttachment att = boardAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
        byte[] bytes = s3FileService.download(att.getFileUrl());
        String encoded = URLEncoder.encode(att.getFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.parseMediaType(att.getContentType() != null ? att.getContentType() : "application/octet-stream"))
                .body(bytes);
    }

    @Transactional
    public void deleteAttachment(Long attachmentId, User currentUser) {
        BoardAttachment att = boardAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
        if (!att.getPost().getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        s3FileService.delete(att.getFileUrl());
        boardAttachmentRepository.delete(att);
    }
}
