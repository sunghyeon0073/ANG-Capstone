package com.ang.Backend.domain.memo.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.memo.dto.MemoDto;
import com.ang.Backend.domain.memo.entity.Memo;
import com.ang.Backend.domain.memo.repository.MemoRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemoService {

    private final MemoRepository memoRepository;

    public List<MemoDto.Response> getMemos(User user) {
        return memoRepository.findByUserOrderByUpdatedAtDesc(user).stream()
                .map(MemoDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public MemoDto.Response createMemo(User user, MemoDto.SaveRequest request) {
        Memo memo = Memo.builder()
                .user(user)
                .title(request.getTitle())
                .content(request.getContent())
                .build();
        return MemoDto.Response.from(memoRepository.save(memo));
    }

    @Transactional
    public MemoDto.Response updateMemo(User user, Long memoId, MemoDto.SaveRequest request) {
        Memo memo = memoRepository.findById(memoId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT)); // Should probably have MEMO_NOT_FOUND

        if (!memo.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        memo.update(request.getTitle(), request.getContent());
        return MemoDto.Response.from(memo);
    }

    @Transactional
    public void deleteMemo(User user, Long memoId) {
        Memo memo = memoRepository.findById(memoId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT));

        if (!memo.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        memoRepository.delete(memo);
    }
}
