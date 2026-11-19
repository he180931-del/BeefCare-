import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';

import { createEntity, getEntity, reset, updateEntity } from './herd-exit.reducer';

export const HerdExitUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const herdExitEntity = useAppSelector(state => state.herdExit.entity);
  const loading = useAppSelector(state => state.herdExit.loading);
  const updating = useAppSelector(state => state.herdExit.updating);
  const updateSuccess = useAppSelector(state => state.herdExit.updateSuccess);

  const handleClose = () => {
    navigate('/herd-exit');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
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
      ...herdExitEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
      confirmedBy: appUsers.find(it => it.id.toString() === values.confirmedBy?.toString()),
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
          ...herdExitEntity,
          cattle: herdExitEntity?.cattle?.id,
          confirmedBy: herdExitEntity?.confirmedBy?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.herdExit.home.createOrEditLabel" data-cy="HerdExitCreateUpdateHeading">
            Thêm mới hoặc cập nhật Herd Exit
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="herd-exit-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Type"
                id="herd-exit-type"
                name="type"
                data-cy="type"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>SALE | DEATH | CULL | OTHER</Tooltip>}>
                <span id="typeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Exit Date"
                id="herd-exit-exitDate"
                name="exitDate"
                data-cy="exitDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Reason" id="herd-exit-reason" name="reason" data-cy="reason" type="textarea" />
              <ValidatedField id="herd-exit-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField
                id="herd-exit-confirmedBy"
                name="confirmedBy"
                data-cy="confirmedBy"
                label="Confirmed By"
                type="select"
                required
              >
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/herd-exit" replace variant="info">
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

export default HerdExitUpdate;
