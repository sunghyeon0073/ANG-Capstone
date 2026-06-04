package com.ang.Backend.domain.approval.event;

public class ApprovalCompletedEvent {

    private final Long docId;

    public ApprovalCompletedEvent(Long docId) {
        this.docId = docId;
    }

    public Long getDocId() {
        return docId;
    }
}
