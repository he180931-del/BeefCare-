import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getSupportTickets } from 'app/entities/support-ticket/support-ticket.reducer';

import { createEntity, getEntity, reset, updateEntity } from './internal-request.reducer';

export const InternalRequestUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const supportTickets = useAppSelector(state => state.supportTicket.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const internalRequestEntity = useAppSelector(state => state.internalRequest.entity);
  const loading = useAppSelector(state => state.internalRequest.loading);
  const updating = useAppSelector(state => state.internalRequest.updating);
  const updateSuccess = useAppSelector(state => state.internalRequest.updateSuccess);

  const handleClose = () => {
    navigate('/internal-request');
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

    const entity = {
      ...internalRequestEntity,
      ...values,
      ticket: supportTickets.find(it => it.id.toString() === values.ticket?.toString()),
      recipient: appUsers.find(it => it.id.toString() === values.recipient?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          ...internalRequestEntity,
          ticket: internalRequestEntity?.ticket?.id,
          recipient: internalRequestEntity?.recipient?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.internalRequest.home.createOrEditLabel" data-cy="InternalRequestCreateUpdateHeading">
            Thêm mới hoặc cập nhật Internal Request
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="internal-request-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Target Role"
                id="internal-request-targetRole"
                name="targetRole"
                data-cy="targetRole"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="State"
                id="internal-request-state"
                name="state"
                data-cy="state"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Outcome"
                id="internal-request-outcome"
                name="outcome"
                data-cy="outcome"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="internal-request-ticket" name="ticket" data-cy="ticket" label="Ticket" type="select" required>
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
              <ValidatedField id="internal-request-recipient" name="recipient" data-cy="recipient" label="Recipient" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/internal-request" replace variant="info">
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

export default InternalRequestUpdate;
