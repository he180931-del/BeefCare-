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
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.BankTransferEvidence}.
 */
@RestController
@RequestMapping("/api/bank-transfer-evidences")
@Transactional
public class BankTransferEvidenceResource {

    private static final Logger LOG = LoggerFactory.getLogger(BankTransferEvidenceResource.class);

    private static final String ENTITY_NAME = "bankTransferEvidence";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final BankTransferEvidenceRepository bankTransferEvidenceRepository;

    public BankTransferEvidenceResource(BankTransferEvidenceRepository bankTransferEvidenceRepository) {
        this.bankTransferEvidenceRepository = bankTransferEvidenceRepository;
    }

    /**
     * {@code POST  /bank-transfer-evidences} : Create a new bankTransferEvidence.
     *
     * @param bankTransferEvidence the bankTransferEvidence to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new bankTransferEvidence, or with status {@code 400 (Bad Request)} if the bankTransferEvidence has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<BankTransferEvidence> createBankTransferEvidence(@Valid @RequestBody BankTransferEvidence bankTransferEvidence)
        throws URISyntaxException {
        LOG.debug("REST request to save BankTransferEvidence : {}", bankTransferEvidence);
        if (bankTransferEvidence.getId() != null) {
            throw new BadRequestAlertException("A new bankTransferEvidence cannot already have an ID", ENTITY_NAME, "idexists");
        }
        bankTransferEvidence = bankTransferEvidenceRepository.save(bankTransferEvidence);
        return ResponseEntity.created(new URI("/api/bank-transfer-evidences/" + bankTransferEvidence.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, bankTransferEvidence.getId().toString()))
            .body(bankTransferEvidence);
    }

    /**
     * {@code PUT  /bank-transfer-evidences/:id} : Updates an existing bankTransferEvidence.
     *
     * @param id the id of the bankTransferEvidence to save.
     * @param bankTransferEvidence the bankTransferEvidence to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated bankTransferEvidence,
     * or with status {@code 400 (Bad Request)} if the bankTransferEvidence is not valid,
     * or with status {@code 500 (Internal Server Error)} if the bankTransferEvidence couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<BankTransferEvidence> updateBankTransferEvidence(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody BankTransferEvidence bankTransferEvidence
    ) throws URISyntaxException {
        LOG.debug("REST request to update BankTransferEvidence : {}, {}", id, bankTransferEvidence);
        if (bankTransferEvidence.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, bankTransferEvidence.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!bankTransferEvidenceRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        bankTransferEvidence = bankTransferEvidenceRepository.save(bankTransferEvidence);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, bankTransferEvidence.getId().toString()))
            .body(bankTransferEvidence);
    }

    /**
     * {@code PATCH  /bank-transfer-evidences/:id} : Partial updates given fields of an existing bankTransferEvidence, field will ignore if it is null
     *
     * @param id the id of the bankTransferEvidence to save.
     * @param bankTransferEvidence the bankTransferEvidence to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated bankTransferEvidence,
     * or with status {@code 400 (Bad Request)} if the bankTransferEvidence is not valid,
     * or with status {@code 404 (Not Found)} if the bankTransferEvidence is not found,
     * or with status {@code 500 (Internal Server Error)} if the bankTransferEvidence couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<BankTransferEvidence> partialUpdateBankTransferEvidence(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody BankTransferEvidence bankTransferEvidence
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update BankTransferEvidence partially : {}, {}", id, bankTransferEvidence);
        if (bankTransferEvidence.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, bankTransferEvidence.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!bankTransferEvidenceRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<BankTransferEvidence> result = bankTransferEvidenceRepository
            .findById(bankTransferEvidence.getId())
            .map(existingBankTransferEvidence -> {
                updateIfPresent(existingBankTransferEvidence::setProviderTxnId, bankTransferEvidence.getProviderTxnId());
                updateIfPresent(existingBankTransferEvidence::setAmount, bankTransferEvidence.getAmount());
                updateIfPresent(existingBankTransferEvidence::setBankPaidAt, bankTransferEvidence.getBankPaidAt());
                updateIfPresent(existingBankTransferEvidence::setQuoteRef, bankTransferEvidence.getQuoteRef());
                updateIfPresent(existingBankTransferEvidence::setDeliveryOutcome, bankTransferEvidence.getDeliveryOutcome());
                updateIfPresent(existingBankTransferEvidence::setAuthOutcome, bankTransferEvidence.getAuthOutcome());

                return existingBankTransferEvidence;
            })
            .map(bankTransferEvidenceRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, bankTransferEvidence.getId().toString())
        );
    }

    /**
     * {@code GET  /bank-transfer-evidences} : get all the Bank Transfer Evidences.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Bank Transfer Evidences in body.
     */
    @GetMapping("")
    public List<BankTransferEvidence> getAllBankTransferEvidences() {
        LOG.debug("REST request to get all BankTransferEvidences");
        return bankTransferEvidenceRepository.findAll();
    }

    /**
     * {@code GET  /bank-transfer-evidences/:id} : get the "id" bankTransferEvidence.
     *
     * @param id the id of the bankTransferEvidence to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the bankTransferEvidence, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<BankTransferEvidence> getBankTransferEvidence(@PathVariable("id") Long id) {
        LOG.debug("REST request to get BankTransferEvidence : {}", id);
        Optional<BankTransferEvidence> bankTransferEvidence = bankTransferEvidenceRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(bankTransferEvidence);
    }

    /**
     * {@code DELETE  /bank-transfer-evidences/:id} : delete the "id" bankTransferEvidence.
     *
     * @param id the id of the bankTransferEvidence to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBankTransferEvidence(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete BankTransferEvidence : {}", id);
        bankTransferEvidenceRepository.deleteById(id);
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
