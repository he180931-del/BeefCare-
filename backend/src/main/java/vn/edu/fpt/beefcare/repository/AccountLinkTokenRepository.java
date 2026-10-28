package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;

@Repository
public interface AccountLinkTokenRepository extends JpaRepository<AccountLinkToken, Long> {
    Optional<AccountLinkToken> findOneByTokenHashAndTokenType(String tokenHash, String tokenType);

    long countByUserIdAndTokenTypeAndCreatedAtAfter(Long userId, String tokenType, Instant since);

    @Modifying
    @Query("update AccountLinkToken t set t.usedAt = :now where t.user.id = :userId and t.tokenType = :type and t.usedAt is null")
    int invalidateUnused(@Param("userId") Long userId, @Param("type") String type, @Param("now") Instant now);
}
