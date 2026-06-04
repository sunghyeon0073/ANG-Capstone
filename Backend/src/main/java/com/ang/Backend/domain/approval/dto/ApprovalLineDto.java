package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.domain.approval.entity.ApprovalLine;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

public class ApprovalLineDto {

    @Getter
    @Builder
    public static class Request {
        private Integer approverId;
        private Integer lineOrder;
        private ApprovalLineType lineType;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private Integer approverId;
        private String approverName;
        private String approverPosition;
        private Integer delegateeId;
        private String delegateeName;
        private Integer lineOrder;
        private ApprovalLineType lineType;
        private ApprovalLineStatus status;
        private String comment;
        private String signatureSnapshot;
        private LocalDateTime processedAt;

        public static Response from(ApprovalLine al) {
            return Response.builder()
                    .id(al.getId())
                    .approverId(al.getApprover().getUserId())
                    .approverName(al.getApprover().getName())
                    .approverPosition(al.getApprover().getPosition())
                    .delegateeId(al.getDelegatee() != null ? al.getDelegatee().getUserId() : null)
                    .delegateeName(al.getDelegatee() != null ? al.getDelegatee().getName() : null)
                    .lineOrder(al.getLineOrder())
                    .lineType(al.getLineType())
                    .status(al.getStatus())
                    .comment(al.getComment())
                    .signatureSnapshot(al.getSignatureSnapshot())
                    .processedAt(al.getProcessedAt())
                    .build();
        }
    }
}
