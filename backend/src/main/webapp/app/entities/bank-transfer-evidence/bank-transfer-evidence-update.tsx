import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getPayments } from 'app/entities/payment/payment.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './bank-transfer-evidence.reducer';

export const BankTransferEvidenceUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const payments = useAppSelector(state => state.payment.entities);
  const bankTransferEvidenceEntity = useAppSelector(state => state.bankTransferEvidence.entity);
  const loading = useAppSelector(state => state.bankTransferEvidence.loading);
  const updating = useAppSelector(state => state.bankTransferEvidence.updating);
  const updateSuccess = useAppSelector(state => state.bankTransferEvidence.updateSuccess);

  const handleClose = () => {
    navigate('/bank-transfer-evidence');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getPayments({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    if (values.providerTxnId !== undefined && typeof values.providerTxnId !== 'number') {
      values.providerTxnId = Number(values.providerTxnId);
    }
    if (values.amount !== undefined && typeof values.amount !== 'number') {
      values.amount = Number(values.amount);
    }
    values.bankPaidAt = convertDateTimeToServer(values.bankPaidAt);

    const entity = {
      ...bankTransferEvidenceEntity,
      ...values,
      payment: payments.find(it => it.id.toString() === values.payment?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {
          bankPaidAt: displayDefaultDateTime(),
        }
      : {
          ...bankTransferEvidenceEntity,
          bankPaidAt: convertDateTimeFromServer(bankTransferEvidenceEntity.bankPaidAt),
          payment: bankTransferEvidenceEntity?.payment?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.bankTransferEvidence.home.createOrEditLabel" data-cy="BankTransferEvidenceCreateUpdateHeading">
            Thêm mới hoặc cập nhật Bank Transfer Evidence
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && (
                <ValidatedField name="id" required readOnly id="bank-transfer-evidence-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Provider Txn Id"
                id="bank-transfer-evidence-providerTxnId"
                name="providerTxnId"
                data-cy="providerTxnId"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Amount"
                id="bank-transfer-evidence-amount"
                name="amount"
                data-cy="amount"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Bank Paid At"
                id="bank-transfer-evidence-bankPaidAt"
                name="bankPaidAt"
                data-cy="bankPaidAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Quote Ref"
                id="bank-transfer-evidence-quoteRef"
                name="quoteRef"
                data-cy="quoteRef"
                type="text"
                validate={{
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: NOT NULL; để trống được vì SePay có thể gửi code = null</Tooltip>}>
                <span id="quoteRefLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Delivery Outcome"
                id="bank-transfer-evidence-deliveryOutcome"
                name="deliveryOutcome"
                data-cy="deliveryOutcome"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: delivery/auth outcome - tách 2 cột</Tooltip>}>
                <span id="deliveryOutcomeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Auth Outcome"
                id="bank-transfer-evidence-authOutcome"
                name="authOutcome"
                data-cy="authOutcome"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="bank-transfer-evidence-payment" name="payment" data-cy="payment" label="Payment" type="select">
                <option value="" key="0" />
                {payments
                  ? payments.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button
                as={Link as any}
                id="cancel-save"
                data-cy="entityCreateCancelButton"
                to="/bank-transfer-evidence"
                replace
                variant="info"
              >
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default BankTransferEvidenceUpdate;
