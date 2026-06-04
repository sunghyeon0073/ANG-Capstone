package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.approval.dto.ApprovalCommentDto;
import com.ang.Backend.domain.approval.entity.ApprovalComment;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.repository.ApprovalCommentRepository;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import com.ang.Backend.domain.approval.repository.ApprovalLineRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalCommentService {

    private final ApprovalCommentRepository commentRepository;
    private final ApprovalDocRepository docRepository;
    private final ApprovalLineRepository lineRepository;

    public List<ApprovalCommentDto.Response> getComments(Long docId, User user) {
        ApprovalDoc doc = findDocAndCheckAccess(docId, user);
        return commentRepository.findByDocOrderByCreatedAtAsc(doc).stream()
                .map(ApprovalCommentDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApprovalCommentDto.Response addComment(Long docId, ApprovalCommentDto.Request req, User user) {
        ApprovalDoc doc = findDocAndCheckAccess(docId, user);
        ApprovalComment comment = ApprovalComment.builder()
                .doc(doc)
                .author(user)
                .content(req.getContent())
                .build();
        return ApprovalCommentDto.Response.from(commentRepository.save(comment));
    }

    private ApprovalDoc findDocAndCheckAccess(Long docId, User user) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));
        boolean isDrafter = doc.getDrafter().getUserId().equals(user.getUserId());
        boolean isParticipant = lineRepository.findByDocOrderByLineOrderAsc(doc).stream()
                .anyMatch(al -> al.getApprover().getUserId().equals(user.getUserId()) ||
                               (al.getDelegatee() != null && al.getDelegatee().getUserId().equals(user.getUserId())));
        if (!isDrafter && !isParticipant) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        return doc;
    }
}
