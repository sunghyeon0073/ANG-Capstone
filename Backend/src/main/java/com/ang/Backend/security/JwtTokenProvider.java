package com.ang.Backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

// TODO: 시큐리티 활성화 시 CustomUserDetailsService 재연결
@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secretKeyString;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    private final CustomUserDetailsService userDetailsService;

    private SecretKey secretKey;

    public JwtTokenProvider(CustomUserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    // 앱 시작 시 한 번만 실행: yml의 jwt.secret 문자열을 HMAC-SHA256 키 객체로 변환
    @PostConstruct
    protected void init() {
        this.secretKey = Keys.hmacShaKeyFor(secretKeyString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public String createAccessToken(String empNo) {
        return buildToken(empNo, accessTokenExpiration);   // 30분
    }

    public String createRefreshToken(String empNo) {
        return buildToken(empNo, refreshTokenExpiration);  // 7일
    }

    // 토큰 생성 공통 로직 (access/refresh 모두 사용)
    private String buildToken(String empNo, long expiration) {
        Date now = new Date();
        return Jwts.builder()
                .subject(empNo)                                     // sub 클레임 = 사번
                .issuedAt(now)                                      // iat = 발급 시각
                .expiration(new Date(now.getTime() + expiration))   // exp = 만료 시각
                .signWith(secretKey)                                 // HS256 서명
                .compact();                                          // "xxxxx.yyyyy.zzzzz"
    }

    // 토큰의 sub 클레임(사번) 추출
    public String getEmpNoFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    // 토큰 유효성 검증 — 만료/위조 시 CustomException으로 변환
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            throw new CustomException(ErrorCode.EXPIRED_TOKEN);   // 만료 → 재발급 유도
        } catch (JwtException | IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);   // 위조 or 형식 오류
        }
    }

    // 토큰 → Spring Security Authentication 객체 변환
    // principal = UserDetails, credentials = null (서명으로 이미 검증됨)
    public Authentication getAuthentication(String token) {
        String empNo = getEmpNoFromToken(token);
        UserDetails userDetails = userDetailsService.loadUserByUsername(empNo); // DB 조회
        return new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
    }

    // 서명 검증 + 클레임 파싱 (실패 시 JwtException 계열 예외 발생)
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
