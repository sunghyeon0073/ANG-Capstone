package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.approval.dto.ApprovalMyLineDto;
import com.ang.Backend.domain.approval.entity.ApprovalMyLine;
import com.ang.Backend.domain.approval.entity.ApprovalMyLineItem;
import com.ang.Backend.domain.approval.repository.ApprovalMyLineRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalMyLineService {

    private final ApprovalMyLineRepository myLineRepository;
    private final UserRepository userRepository;

    public List<ApprovalMyLineDto.Response> getMyLines(User user) {
        return myLineRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(ApprovalMyLineDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApprovalMyLineDto.Response create(ApprovalMyLineDto.Request req, User user) {
        ApprovalMyLine myLine = ApprovalMyLine.builder()
                .user(user)
                .name(req.getName())
                .build();

        List<ApprovalMyLineItem> items = req.getItems().stream().map(itemReq -> {
            User approver = userRepository.findById(itemReq.getApproverId())
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
            return ApprovalMyLineItem.builder()
                    .myLine(myLine)
                    .approver(approver)
                    .lineOrder(itemReq.getLineOrder())
                    .lineType(itemReq.getLineType())
                    .build();
        }).collect(Collectors.toList());

        myLine.getItems().addAll(items);
        return ApprovalMyLineDto.Response.from(myLineRepository.save(myLine));
    }

    @Transactional
    public void delete(Long lineId, User user) {
        ApprovalMyLine myLine = myLineRepository.findById(lineId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_MY_LINE_NOT_FOUND));
        if (!myLine.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        myLineRepository.delete(myLine);
    }
}
