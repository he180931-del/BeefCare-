package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.ResponseUtil;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.CashReportSnapshot}.
 */
@RestController
@RequestMapping("/api/cash-report-snapshots")
@Transactional
public class CashReportSnapshotResource {

    private static final Logger LOG = LoggerFactory.getLogger(CashReportSnapshotResource.class);

    private static final String ENTITY_NAME = "cashReportSnapshot";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CashReportSnapshotRepository cashReportSnapshotRepository;

    public CashReportSnapshotResource(CashReportSnapshotRepository cashReportSnapshotRepository) {
        this.cashReportSnapshotRepository = cashReportSnapshotRepository;
    }

    /**
     * {@code POST  /cash-report-snapshots} : Create a new cashReportSnapshot.
     *
     * @param cashReportSnapshot the cashReportSnapshot to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new cashReportSnapshot, or with status {@code 400 (Bad Request)} if the cashReportSnapshot has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<CashReportSnapshot> createCashReportSnapshot(@Valid @RequestBody CashReportSnapshot cashReportSnapshot)
        throws URISyntaxException {
        LOG.debug("REST request to save CashReportSnapshot : {}", cashReportSnapshot);
        if (cashReportSnapshot.getId() != null) {
            throw new BadRequestAlertException("A new cashReportSnapshot cannot already have an ID", ENTITY_NAME, "idexists");
        }
        cashReportSnapshot = cashReportSnapshotRepository.save(cashReportSnapshot);
        return ResponseEntity.created(new URI("/api/cash-report-snapshots/" + cashReportSnapshot.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, cashReportSnapshot.getId().toString()))
            .body(cashReportSnapshot);
    }

    /**
     * {@code PUT  /cash-report-snapshots/:id} : Updates an existing cashReportSnapshot.
     *
     * @param id the id of the cashReportSnapshot to save.
     * @param cashReportSnapshot the cashReportSnapshot to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cashReportSnapshot,
     * or with status {@code 400 (Bad Request)} if the cashReportSnapshot is not valid,
     * or with status {@code 500 (Internal Server Error)} if the cashReportSnapshot couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<CashReportSnapshot> updateCashReportSnapshot(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody CashReportSnapshot cashReportSnapshot
    ) throws URISyntaxException {
        LOG.debug("REST request to update CashReportSnapshot : {}, {}", id, cashReportSnapshot);
        if (cashReportSnapshot.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cashReportSnapshot.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cashReportSnapshotRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        cashReportSnapshot = cashReportSnapshotRepository.save(cashReportSnapshot);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cashReportSnapshot.getId().toString()))
            .body(cashReportSnapshot);
    }

    /**
     * {@code PATCH  /cash-report-snapshots/:id} : Partial updates given fields of an existing cashReportSnapshot, field will ignore if it is null
     *
     * @param id the id of the cashReportSnapshot to save.
     * @param cashReportSnapshot the cashReportSnapshot to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cashReportSnapshot,
     * or with status {@code 400 (Bad Request)} if the cashReportSnapshot is not valid,
     * or with status {@code 404 (Not Found)} if the cashReportSnapshot is not found,
     * or with status {@code 500 (Internal Server Error)} if the cashReportSnapshot couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<CashReportSnapshot> partialUpdateCashReportSnapshot(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody CashReportSnapshot cashReportSnapshot
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update CashReportSnapshot partially : {}, {}", id, cashReportSnapshot);
        if (cashReportSnapshot.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cashReportSnapshot.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cashReportSnapshotRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<CashReportSnapshot> result = cashReportSnapshotRepository
            .findById(cashReportSnapshot.getId())
            .map(existingCashReportSnapshot -> {
                updateIfPresent(existingCashReportSnapshot::setAsOf, cashReportSnapshot.getAsOf());
                updateIfPresent(existingCashReportSnapshot::setDateFrom, cashReportSnapshot.getDateFrom());
                updateIfPresent(existingCashReportSnapshot::setDateTo, cashReportSnapshot.getDateTo());
                updateIfPresent(existingCashReportSnapshot::setTotals, cashReportSnapshot.getTotals());

                return existingCashReportSnapshot;
            })
            .map(cashReportSnapshotRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cashReportSnapshot.getId().toString())
        );
    }

    /**
     * {@code GET  /cash-report-snapshots} : get all the Cash Report Snapshots.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Cash Report Snapshots in body.
     */
    @GetMapping("")
    public List<CashReportSnapshot> getAllCashReportSnapshots() {
        LOG.debug("REST request to get all CashReportSnapshots");
        return cashReportSnapshotRepository.findAll();
    }

    /**
     * {@code GET  /cash-report-snapshots/:id} : get the "id" cashReportSnapshot.
     *
     * @param id the id of the cashReportSnapshot to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the cashReportSnapshot, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<CashReportSnapshot> getCashReportSnapshot(@PathVariable("id") Long id) {
        LOG.debug("REST request to get CashReportSnapshot : {}", id);
        Optional<CashReportSnapshot> cashReportSnapshot = cashReportSnapshotRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(cashReportSnapshot);
    }

    /**
     * {@code DELETE  /cash-report-snapshots/:id} : delete the "id" cashReportSnapshot.
     *
     * @param id the id of the cashReportSnapshot to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCashReportSnapshot(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete CashReportSnapshot : {}", id);
        cashReportSnapshotRepository.deleteById(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }

    private <T> void updateIfPresent(Consumer<T> setter, T value) {
        if (value != null) {
            setter.accept(value);
        }
    }
}
