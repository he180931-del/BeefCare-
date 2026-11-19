package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.IdempotencyRecord;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.IdempotencyRecordRepository;

class IdempotencyCommandServiceTest {

    private final IdempotencyRecordRepository records = mock(IdempotencyRecordRepository.class);
    private final FarmAccessService access = mock(FarmAccessService.class);
    private final PlatformAccessService platformAccess = mock(PlatformAccessService.class);
    private final OutboxService outbox = mock(OutboxService.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private IdempotencyCommandService commands;

    @BeforeEach
    void setUp() {
        AppUser user = new AppUser();
        user.setId(41L);
        when(access.currentActiveUser()).thenReturn(user);
        when(access.require(eq(12L), eq(FarmAction.MANAGE_PENS))).thenReturn(new FarmContext(new Farm(), user, FarmRole.MANAGER));
        when(transactions.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        commands = new IdempotencyCommandService(records, access, platformAccess, outbox, mapper, transactions);
    }

    @Test
    void matchingKeyAndPayloadReplaysStoredResultWithoutCallingCommand() throws Exception {
        Map<String, Object> request = Map.of("name", "north pen");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "PEN_CREATE", "req-1"))
            .thenReturn(Optional.of(record(request, "\"saved\"")));
        AtomicInteger calls = new AtomicInteger();

        String result = commands.execute(12L, FarmAction.MANAGE_PENS, "PEN_CREATE", "req-1", request, String.class, () -> {
            calls.incrementAndGet();
            return "new";
        });

        assertThat(result).isEqualTo("saved");
        assertThat(calls).hasValue(0);
    }

    @Test
    void sameKeyWithChangedPayloadReturnsConflict() throws Exception {
        Map<String, Object> original = Map.of("name", "north pen");
        Map<String, Object> changed = Map.of("name", "south pen");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "PEN_CREATE", "req-1"))
            .thenReturn(Optional.of(record(original, "\"saved\"")));

        assertThatThrownBy(() -> commands.execute(12L, FarmAction.MANAGE_PENS, "PEN_CREATE", "req-1", changed, String.class, () -> "unused"))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getStatus().value()).isEqualTo(409);
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_19);
            });
    }

    @Test
    void concurrentUniqueKeyWinnerIsReadAndReplayed() throws Exception {
        Map<String, Object> request = Map.of("name", "north pen");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "PEN_CREATE", "req-1"))
            .thenReturn(Optional.empty(), Optional.of(record(request, "\"winner\"")));
        doThrow(new DataIntegrityViolationException("unique key" )).when(records).saveAndFlush(any(IdempotencyRecord.class));
        AtomicInteger calls = new AtomicInteger();

        String result = commands.execute(12L, FarmAction.MANAGE_PENS, "PEN_CREATE", "req-1", request, String.class, () -> {
            calls.incrementAndGet();
            return "loser";
        });

        assertThat(result).isEqualTo("winner");
        assertThat(calls).hasValue(0);
    }

    @Test
    void callbackFailureRollsBackReservationAndNeverSavesResult() {
        Map<String, Object> request = Map.of("name", "north pen");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(eq(41L), eq(12L), eq("PEN_CREATE"), eq("req-1")))
            .thenReturn(Optional.empty());
        when(records.saveAndFlush(any(IdempotencyRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertThatThrownBy(() -> commands.execute(12L, FarmAction.MANAGE_PENS, "PEN_CREATE", "req-1", request, String.class, () -> {
            throw new IllegalStateException("fail before commit");
        })).isInstanceOf(IllegalStateException.class);

        verify(records, times(1)).saveAndFlush(any(IdempotencyRecord.class));
        verify(records, times(1)).findByActorIdAndFarmScopeAndActionAndIdempotencyKey(eq(41L), eq(12L), eq("PEN_CREATE"), eq("req-1"));
        verify(transactions).rollback(any(TransactionStatus.class));
    }

    @Test
    void boundedLimitSupportsTwoHundredLineImportAndLargeReplayResult() {
        var lines = java.util.stream.IntStream.range(0, 200).mapToObj(i -> Map.of("line", i, "note", "x".repeat(2_048))).toList();
        Map<String, Object> request = Map.of("lines", lines);
        String response = "r".repeat(400_000);
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "VOUCHER_IMPORT", "bulk-200")).thenReturn(Optional.empty());

        assertThat(commands.execute(12L, FarmAction.MANAGE_PENS, "VOUCHER_IMPORT", "bulk-200", request, String.class, () -> response)).isEqualTo(response);
        verify(records, times(2)).saveAndFlush(any(IdempotencyRecord.class));
    }

    @Test
    void revokedFarmAccessPreventsReplay() throws Exception {
        Map<String, Object> request = Map.of("name", "north pen");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "PEN_CREATE", "req-1"))
            .thenReturn(Optional.of(record(request, "\"saved\"")));
        when(access.require(12L, FarmAction.MANAGE_PENS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> commands.execute(12L, FarmAction.MANAGE_PENS, "PEN_CREATE", "req-1", request, String.class, () -> "unused"))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        verify(records, times(0)).findByActorIdAndFarmScopeAndActionAndIdempotencyKey(any(), any(), any(), any());
    }

    @Test
    void lowerRoleCannotReplayCommandOutsideItsFarmPermission() throws Exception {
        Map<String, Object> request = Map.of("name", "buyer");
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L, 12L, "TRADING_PARTNER_CREATE", "req-1"))
            .thenReturn(Optional.of(record(request, "\"saved\"")));
        when(access.require(12L, FarmAction.MANAGE_BUYERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> commands.execute(12L, FarmAction.MANAGE_BUYERS, "TRADING_PARTNER_CREATE", "req-1", request, String.class, () -> "unused"))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        verify(records, times(0)).findByActorIdAndFarmScopeAndActionAndIdempotencyKey(any(), any(), any(), any());
    }

    @Test
    void mutablePlatformAssignmentIsRecheckedBeforeCachedReplay() throws Exception {
        Map<String,Object> request=Map.of("ticketId",7L,"assigneeId",41L);
        AppUser user=access.currentActiveUser();
        when(platformAccess.requireRole(PlatformRole.CS)).thenReturn(new PlatformContext(user,null,PlatformRole.CS));
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L,0L,"TICKET_ASSIGN","req-1"))
            .thenReturn(Optional.of(record(request,"\"saved\"")));
        AtomicInteger checks=new AtomicInteger();
        assertThat(commands.executePlatformAuthorized(PlatformRole.CS,"TICKET_ASSIGN","req-1",request,String.class,checks::incrementAndGet,()->"unused"))
            .isEqualTo("saved");
        assertThat(checks).hasValue(1);
    }

    @Test
    void revokedNamedPlatformAssignmentBlocksCachedReplay() throws Exception {
        Map<String,Object> request=Map.of("ticketId",7L,"assigneeId",41L);
        AppUser user=access.currentActiveUser();
        when(platformAccess.requireRole(PlatformRole.CS)).thenReturn(new PlatformContext(user,null,PlatformRole.CS));
        when(records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(41L,0L,"TICKET_ASSIGN","req-1"))
            .thenReturn(Optional.of(record(request,"\"saved\"")));
        AtomicInteger commandsCalled=new AtomicInteger();
        assertThatThrownBy(()->commands.executePlatformAuthorized(PlatformRole.CS,"TICKET_ASSIGN","req-1",request,String.class,
            ()->{throw DomainException.forbidden(MessageCodes.COM_01);},()->{commandsCalled.incrementAndGet();return "unused";}))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        assertThat(commandsCalled).hasValue(0);
        verify(records,never()).findByActorIdAndFarmScopeAndActionAndIdempotencyKey(any(),any(),any(),any());
    }

    private IdempotencyRecord record(Object request, String responseJson) throws Exception {
        byte[] requestBytes = mapper.writeValueAsBytes(request);
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(requestBytes));
        IdempotencyRecord record = new IdempotencyRecord();
        record.setPayloadHash(hash);
        record.setResultType(String.class.getName());
        record.setResultJson(responseJson);
        return record;
    }
}
