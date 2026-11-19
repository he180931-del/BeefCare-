import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getSupportTickets } from 'app/entities/support-ticket/support-ticket.reducer';

import { createEntity, getEntity, reset, updateEntity } from './ticket-message.reducer';

export const TicketMessageUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const supportTickets = useAppSelector(state => state.supportTicket.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const ticketMessageEntity = useAppSelector(state => state.ticketMessage.entity);
  const loading = useAppSelector(state => state.ticketMessage.loading);
  const updating = useAppSelector(state => state.ticketMessage.updating);
  const updateSuccess = useAppSelector(state => state.ticketMessage.updateSuccess);

  const handleClose = () => {
    navigate('/ticket-message');
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
      ...ticketMessageEntity,
      ...values,
      ticket: supportTickets.find(it => it.id.toString() === values.ticket?.toString()),
      author: appUsers.find(it => it.id.toString() === values.author?.toString()),
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
          ...ticketMessageEntity,
          ticket: ticketMessageEntity?.ticket?.id,
          author: ticketMessageEntity?.author?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.ticketMessage.home.createOrEditLabel" data-cy="TicketMessageCreateUpdateHeading">
            Thêm mới hoặc cập nhật Ticket Message
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="ticket-message-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Type"
                id="ticket-message-type"
                name="type"
                data-cy="type"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Audience"
                id="ticket-message-audience"
                name="audience"
                data-cy="audience"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Content"
                id="ticket-message-content"
                name="content"
                data-cy="content"
                type="textarea"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField id="ticket-message-ticket" name="ticket" data-cy="ticket" label="Ticket" type="select" required>
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
              <ValidatedField id="ticket-message-author" name="author" data-cy="author" label="Author" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/ticket-message" replace variant="info">
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

export default TicketMessageUpdate;
