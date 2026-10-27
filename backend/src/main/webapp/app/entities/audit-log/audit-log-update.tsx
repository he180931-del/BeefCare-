import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './audit-log.reducer';

export const AuditLogUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const appUsers = useAppSelector(state => state.appUser.entities);
  const farms = useAppSelector(state => state.farm.entities);
  const auditLogEntity = useAppSelector(state => state.auditLog.entity);
  const loading = useAppSelector(state => state.auditLog.loading);
  const updating = useAppSelector(state => state.auditLog.updating);
  const updateSuccess = useAppSelector(state => state.auditLog.updateSuccess);

  const handleClose = () => {
    navigate('/audit-log');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getAppUsers({}));
    dispatch(getFarms({}));
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
    if (values.targetId !== undefined && typeof values.targetId !== 'number') {
      values.targetId = Number(values.targetId);
    }
    values.loggedAt = convertDateTimeToServer(values.loggedAt);

    const entity = {
      ...auditLogEntity,
      ...values,
      actor: appUsers.find(it => it.id.toString() === values.actor?.toString()),
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
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
          loggedAt: displayDefaultDateTime(),
        }
      : {
          ...auditLogEntity,
          loggedAt: convertDateTimeFromServer(auditLogEntity.loggedAt),
          actor: auditLogEntity?.actor?.id,
          farm: auditLogEntity?.farm?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.auditLog.home.createOrEditLabel" data-cy="AuditLogCreateUpdateHeading">
            Thêm mới hoặc cập nhật Audit Log
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="audit-log-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Action"
                id="audit-log-action"
                name="action"
                data-cy="action"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Target Type"
                id="audit-log-targetType"
                name="targetType"
                data-cy="targetType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: target_type/id - tách thành 2 cột</Tooltip>}>
                <span id="targetTypeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Target Id"
                id="audit-log-targetId"
                name="targetId"
                data-cy="targetId"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Logged At"
                id="audit-log-loggedAt"
                name="loggedAt"
                data-cy="loggedAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
                <span id="loggedAtLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="audit-log-actor" name="actor" data-cy="actor" label="Actor" type="select" required>
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
              <ValidatedField id="audit-log-farm" name="farm" data-cy="farm" label="Farm" type="select">
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/audit-log" replace variant="info">
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

export default AuditLogUpdate;
