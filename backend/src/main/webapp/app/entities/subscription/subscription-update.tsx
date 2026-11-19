import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { getEntities as getPlanVersions } from 'app/entities/plan-version/plan-version.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './subscription.reducer';

export const SubscriptionUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farms = useAppSelector(state => state.farm.entities);
  const planVersions = useAppSelector(state => state.planVersion.entities);
  const subscriptionEntity = useAppSelector(state => state.subscription.entity);
  const loading = useAppSelector(state => state.subscription.loading);
  const updating = useAppSelector(state => state.subscription.updating);
  const updateSuccess = useAppSelector(state => state.subscription.updateSuccess);

  const handleClose = () => {
    navigate('/subscription');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarms({}));
    dispatch(getPlanVersions({}));
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
    values.latestEnd = convertDateTimeToServer(values.latestEnd);

    const entity = {
      ...subscriptionEntity,
      ...values,
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
      planVersion: planVersions.find(it => it.id.toString() === values.planVersion?.toString()),
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
          latestEnd: displayDefaultDateTime(),
        }
      : {
          ...subscriptionEntity,
          latestEnd: convertDateTimeFromServer(subscriptionEntity.latestEnd),
          farm: subscriptionEntity?.farm?.id,
          planVersion: subscriptionEntity?.planVersion?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.subscription.home.createOrEditLabel" data-cy="SubscriptionCreateUpdateHeading">
            Thêm mới hoặc cập nhật Subscription
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="subscription-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Entitlement Status"
                id="subscription-entitlementStatus"
                name="entitlementStatus"
                data-cy="entitlementStatus"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Latest End"
                id="subscription-latestEnd"
                name="latestEnd"
                data-cy="latestEnd"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <OverlayTrigger
                overlay={<Tooltip>ERD: varchar(255) NOT NULL; đổi sang thời điểm và để trống được vì farm mới chưa có kỳ đã trả</Tooltip>}
              >
                <span id="latestEndLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="subscription-farm" name="farm" data-cy="farm" label="Farm" type="select" required>
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField
                id="subscription-planVersion"
                name="planVersion"
                data-cy="planVersion"
                label="Plan Version"
                type="select"
                required
              >
                <option value="" key="0" />
                {planVersions
                  ? planVersions.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/subscription" replace variant="info">
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

export default SubscriptionUpdate;
