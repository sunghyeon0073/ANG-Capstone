package org.example.capstoneBack.domain.approval.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.ApprovalStatus;
import org.example.capstoneBack.domain.approval.entity.Approval;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class ApprovalDto {

    private Long approvalId;
    private Long requesterId;
    private String requesterName;
    private Long scopeId;
    private String title;
    private String content;
    private ApprovalStatus status;
    private LocalDateTime createdAt;

    public static ApprovalDto from(Approval approval) {
        return ApprovalDto.builder()
                .approvalId(approval.getApprovalId())
                .requesterId(approval.getRequester().getUserId())
                .requesterName(approval.getRequester().getName())
                .scopeId(approval.getScope().getScopeId())
                .title(approval.getTitle())
                .content(approval.getContent())
                .status(approval.getStatus())
                .createdAt(approval.getCreatedAt())
                .build();
    }
}
