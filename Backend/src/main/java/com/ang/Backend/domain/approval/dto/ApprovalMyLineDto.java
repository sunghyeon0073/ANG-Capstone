package com.ang.Backend.domain.approval.dto;

import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.domain.approval.entity.ApprovalMyLine;
import com.ang.Backend.domain.approval.entity.ApprovalMyLineItem;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class ApprovalMyLineDto {

    @Getter
    @Builder
    public static class Request {
        private String name;
        private List<ItemRequest> items;
    }

    @Getter
    @Builder
    public static class ItemRequest {
        private Integer approverId;
        private Integer lineOrder;
        private ApprovalLineType lineType;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private String name;
        private LocalDateTime createdAt;
        private List<ItemResponse> items;

        public static Response from(ApprovalMyLine ml) {
            return Response.builder()
                    .id(ml.getId())
                    .name(ml.getName())
                    .createdAt(ml.getCreatedAt())
                    .items(ml.getItems().stream()
                            .map(ItemResponse::from)
                            .collect(Collectors.toList()))
                    .build();
        }
    }

    @Getter
    @Builder
    public static class ItemResponse {
        private Long id;
        private Integer approverId;
        private String approverName;
        private String approverPosition;
        private Integer lineOrder;
        private ApprovalLineType lineType;

        public static ItemResponse from(ApprovalMyLineItem item) {
            return ItemResponse.builder()
                    .id(item.getId())
                    .approverId(item.getApprover().getUserId())
                    .approverName(item.getApprover().getName())
                    .approverPosition(item.getApprover().getPosition())
                    .lineOrder(item.getLineOrder())
                    .lineType(item.getLineType())
                    .build();
        }
    }
}
