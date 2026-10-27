import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getSubscriptions } from 'app/entities/subscription/subscription.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './payment.reducer';

export const PaymentUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const subscriptions = useAppSelector(state => state.subscription.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const paymentEntity = useAppSelector(state => state.payment.entity);
  const loading = useAppSelector(state => state.payment.loading);
  const updating = useAppSelector(state => state.payment.updating);
  const updateSuccess = useAppSelector(state => state.payment.updateSuccess);

  const handleClose = () => {
    navigate('/payment');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getSubscriptions({}));
    dispatch(getAppUsers({}));
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
    if (values.durationYears !== undefined && typeof values.durationYears !== 'number') {
      values.durationYears = Number(values.durationYears);
    }
    if (values.amountVnd !== undefined && typeof values.amountVnd !== 'number') {
      values.amountVnd = Number(values.amountVnd);
    }
    values.expiresAt = convertDateTimeToServer(values.expiresAt);
    values.purchasedStart = convertDateTimeToServer(values.purchasedStart);
    values.purchasedEnd = convertDateTimeToServer(values.purchasedEnd);

    const entity = {
      ...paymentEntity,
      ...values,
      subscription: subscriptions.find(it => it.id.toString() === values.subscription?.toString()),
      requestedBy: appUsers.find(it => it.id.toString() === values.requestedBy?.toString()),
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
          expiresAt: displayDefaultDateTime(),
          purchasedStart: displayDefaultDateTime(),
          purchasedEnd: displayDefaultDateTime(),
        }
      : {
          ...paymentEntity,
          expiresAt: convertDateTimeFromServer(paymentEntity.expiresAt),
          purchasedStart: convertDateTimeFromServer(paymentEntity.purchasedStart),
          purchasedEnd: convertDateTimeFromServer(paymentEntity.purchasedEnd),
          subscription: paymentEntity?.subscription?.id,
          requestedBy: paymentEntity?.requestedBy?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.payment.home.createOrEditLabel" data-cy="PaymentCreateUpdateHeading">
            Thêm mới hoặc cập nhật Payment
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="payment-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Quote Ref"
                id="payment-quoteRef"
                name="quoteRef"
                data-cy="quoteRef"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField
                label="Duration Years"
                id="payment-durationYears"
                name="durationYears"
                data-cy="durationYears"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  min: { value: 1, message: 'Trường này phải lớn hơn 1.' },
                  max: { value: 3, message: 'Trường này phải nhỏ hơn 3.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: varchar(255); giá trị 1, 2 hoặc 3 năm</Tooltip>}>
                <span id="durationYearsLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Amount Vnd"
                id="payment-amountVnd"
                name="amountVnd"
                data-cy="amountVnd"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="State"
                id="payment-state"
                name="state"
                data-cy="state"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>PENDING | PAID | EXPIRED</Tooltip>}>
                <span id="stateLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Expires At"
                id="payment-expiresAt"
                name="expiresAt"
                data-cy="expiresAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Purchased Start"
                id="payment-purchasedStart"
                name="purchasedStart"
                data-cy="purchasedStart"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <OverlayTrigger overlay={<Tooltip>ERD: purchased_start/end varchar(255) - tách 2 cột thời điểm, chỉ có khi PAID</Tooltip>}>
                <span id="purchasedStartLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Purchased End"
                id="payment-purchasedEnd"
                name="purchasedEnd"
                data-cy="purchasedEnd"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <ValidatedField
                id="payment-subscription"
                name="subscription"
                data-cy="subscription"
                label="Subscription"
                type="select"
                required
              >
                <option value="" key="0" />
                {subscriptions
                  ? subscriptions.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="payment-requestedBy" name="requestedBy" data-cy="requestedBy" label="Requested By" type="select" required>
                <option value="" key="0" />
                {appUsers
                  ? appUsers.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/payment" replace variant="info">
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

export default PaymentUpdate;
