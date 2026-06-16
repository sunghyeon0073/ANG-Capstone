package com.ang.Backend.common.exception;

import lombok.extern.slf4j.Slf4j;
import com.ang.Backend.common.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CustomException.class)
    public ResponseEntity<ApiResponse<Void>> handleCustomException(CustomException e) {
        log.warn("CustomException: {}", e.getMessage());
        return ResponseEntity
                .status(e.getErrorCode().getHttpStatus())
                // 리팩토링: ApiResponse 정규화 규격(status 포함) 적용
                .body(ApiResponse.error(e.getErrorCode().getHttpStatus().value(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : e.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity
                .badRequest()
                // 리팩토링: ApiResponse 정규화 규격 적용 (데이터 포함 에러는 fail 그대로 유지하거나 확장 가능)
                .body(ApiResponse.fail("입력값 검증 실패", errors));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException e) {
        return ResponseEntity
                .status(ErrorCode.FORBIDDEN.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.FORBIDDEN.getHttpStatus().value(), ErrorCode.FORBIDDEN.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unhandled exception: ", e);
        String message = "서버 내부 오류가 발생했습니다: " + e.getMessage();
        return ResponseEntity
                .status(ErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus())
                .body(ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus().value(), message));
    }
}
