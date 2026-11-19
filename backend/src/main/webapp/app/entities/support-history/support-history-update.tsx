import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getSupportTickets } from 'app/entities/support-ticket/support-ticket.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './support-history.reducer';

export const SupportHistoryUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const supportTickets = useAppSelector(state => state.supportTicket.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const supportHistoryEntity = useAppSelector(state => state.supportHistory.entity);
  const loading = useAppSelector(state => state.supportHistory.loading);
  const updating = useAppSelector(state => state.supportHistory.updating);
  const updateSuccess = useAppSelector(state => state.supportHistory.updateSuccess);

  const handleClose = () => {
    navigate('/support-history');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getSupportTickets({}));
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
    values.occurredAt = convertDateTimeToServer(values.occurredAt);

    const entity = {
      ...supportHistoryEntity,
      ...values,
      ticket: supportTickets.find(it => it.id.toString() === values.ticket?.toString()),
      actor: appUsers.find(it => it.id.toString() === values.actor?.toString()),
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
          occurredAt: displayDefaultDateTime(),
        }
      : {
          ...supportHistoryEntity,
          occurredAt: convertDateTimeFromServer(supportHistoryEntity.occurredAt),
          ticket: supportHistoryEntity?.ticket?.id,
          actor: supportHistoryEntity?.actor?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.supportHistory.home.createOrEditLabel" data-cy="SupportHistoryCreateUpdateHeading">
            Thêm mới hoặc cập nhật Support History
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="support-history-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Event Type"
                id="support-history-eventType"
                name="eventType"
                data-cy="eventType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Prior State"
                id="support-history-priorState"
                name="priorState"
                data-cy="priorState"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: prior/new state - tách 2 cột; priorState để trống được cho sự kiện đầu tiên</Tooltip>}>
                <span id="priorStateLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="New State"
                id="support-history-newState"
                name="newState"
                data-cy="newState"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Occurred At"
                id="support-history-occurredAt"
                name="occurredAt"
                data-cy="occurredAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
                <span id="occurredAtLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="support-history-ticket" name="ticket" data-cy="ticket" label="Ticket" type="select" required>
                <option value="" key="0" />
                {supportTickets
                  ? supportTickets.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="support-history-actor" name="actor" data-cy="actor" label="Actor" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/support-history" replace variant="info">
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

export default SupportHistoryUpdate;
